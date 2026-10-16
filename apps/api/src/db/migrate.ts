import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnv } from "../config/env";
import { createDatabase } from "./client";

// Resolved from the working directory rather than the compiled file location, so the
// same command works from source and from dist. Run it from apps/api.
const drizzleDir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "drizzle");

async function main() {
  const env = loadEnv();
  const { client } = createDatabase(env.DATABASE_URL, 2);
  try {
    await client.unsafe(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (await client.unsafe<{ name: string }[]>("select name from schema_migrations")).map(
        (r) => r.name,
      ),
    );

    const files = (await readdir(drizzleDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlText = await readFile(join(drizzleDir, file), "utf8");
      await client.begin(async (tx) => {
        await tx.unsafe(sqlText);
        await tx.unsafe("insert into schema_migrations (name) values ($1)", [file]);
      });
      process.stdout.write(`applied ${file}\n`);
    }

    // Policies are re-applied on every run. They are written to be safe to repeat, so a
    // redeploy does not need to track which ones already landed, and a policy that was
    // changed by hand on the server is put back.
    const rlsDir = join(drizzleDir, "rls");
    const policies = (await readdir(rlsDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of policies) {
      const sqlText = await readFile(join(rlsDir, file), "utf8");
      await client.unsafe(sqlText);
      process.stdout.write(`applied rls/${file}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
