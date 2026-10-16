import { loadEnv } from "../config/env";
import { seedCatalogue } from "./seed-catalogue";
import { createDatabase } from "./client";

/**
 * Loads the published catalogue. Safe to run again: every scenario is matched on slug
 * and replaced, so a content change is a re-run rather than a migration.
 */
async function main() {
  const env = loadEnv();
  const { client } = createDatabase(env.DATABASE_URL, 2);
  try {
    const count = await seedCatalogue(client);
    process.stdout.write(`seeded ${count} scenarios\n`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
