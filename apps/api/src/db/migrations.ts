import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

export interface MigrationOptions {
  /** Directory holding the numbered .sql files and the rls/ subdirectory. */
  dir: string;
  /** Where progress and Postgres notices are written. Silent by default. */
  log?: (line: string) => void;
}

/**
 * Applies schema migrations once each, then re-applies every policy file.
 *
 * Policies are repeated on purpose. They are written to be safe to run again, so a
 * redeploy does not have to track which ones already landed, and a policy that was
 * changed by hand on the server is put back where it belongs.
 */
export async function runMigrations(url: string, options: MigrationOptions): Promise<void> {
  const log = options.log ?? (() => {});
  // Policy files drop before they create, so a first run emits a notice per policy. They
  // go to the caller's logger rather than to stderr, which is what keeps a test run
  // readable without hiding anything from a deploy.
  const client = postgres(url, {
    max: 2,
    prepare: false,
    onnotice: (notice) => log(`notice: ${notice.message}`),
  });
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

    const files = (await readdir(options.dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlText = await readFile(join(options.dir, file), "utf8");
      await client.begin(async (tx) => {
        await tx.unsafe(sqlText);
        await tx.unsafe("insert into schema_migrations (name) values ($1)", [file]);
      });
      log(`applied ${file}`);
    }

    const rlsDir = join(options.dir, "rls");
    const policies = (await readdir(rlsDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of policies) {
      const sqlText = await readFile(join(rlsDir, file), "utf8");
      await client.unsafe(sqlText);
      log(`applied rls/${file}`);
    }
  } finally {
    await client.end();
  }
}
