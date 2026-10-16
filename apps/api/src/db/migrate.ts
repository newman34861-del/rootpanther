import { join } from "node:path";
import { loadEnv } from "../config/env";
import { runMigrations } from "./migrations";

// Resolved from the working directory rather than the compiled file location, so the
// same command works from source and from dist. Run it from apps/api.
const drizzleDir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "drizzle");

async function main() {
  const env = loadEnv();
  await runMigrations(env.DATABASE_URL, {
    dir: drizzleDir,
    log: (line) => process.stdout.write(`${line}\n`),
  });
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
