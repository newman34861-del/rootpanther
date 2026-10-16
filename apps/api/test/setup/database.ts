import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import { runMigrations } from "../../src/db/migrations";

/**
 * Brings up the database the suite needs, so that running the tests takes no setup.
 *
 * The tenancy test is the one that must never be skipped, and a test that can only run
 * on a machine with Postgres already installed and migrated gets skipped in practice.
 * This starts a real Postgres in a temporary directory, builds the same three roles
 * production uses, and tears it down afterwards.
 *
 * When TEST_DATABASE_URL is already set this does nothing at all: CI supplies its own
 * server as a service container, and silently starting a second one would mean the
 * suite passed against a database nobody configured.
 */

const DB = "rootpanther";
const APP_ROLE = "rp_app";
const APP_PASSWORD = "apppw";
const ADMIN_ROLE = "rp_admin";
const ADMIN_PASSWORD = "adminpw";

let server: EmbeddedPostgres | undefined;
let dataDir: string | undefined;

// Postgres writes a checkpoint and a shutdown notice for every run, and the tenancy test
// deliberately provokes policy violations, so relaying all of it would bury the result.
// The last lines are kept and printed only when setup fails, which is the one time they
// say something.
const recent: string[] = [];
function remember(message: unknown): void {
  recent.push(String(message).trimEnd());
  if (recent.length > 40) recent.shift();
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (typeof address === "string" || address === null) {
        probe.close(() => reject(new Error("could not determine a free port")));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

export async function setup(): Promise<void> {
  if (process.env.TEST_DATABASE_URL) return;
  try {
    await start();
  } catch (err) {
    process.stderr.write(`${recent.join("\n")}\n`);
    throw err;
  }
}

async function start(): Promise<void> {
  // initdb and its helpers inherit this environment and complain on stderr when the
  // locale is unset, which is the normal state inside a slim container image.
  process.env.LC_ALL ??= "C";
  process.env.LANG ??= "C";

  const port = await freePort();
  dataDir = await mkdtemp(join(tmpdir(), "rootpanther-pg-"));
  server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    // initdb reads the ambient locale and refuses when it is unset, which is the normal
    // state inside a slim container image.
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    onLog: remember,
    onError: remember,
  });

  await server.initialise();
  await server.start();
  await server.createDatabase(DB);

  const superUrl = `postgres://postgres:postgres@127.0.0.1:${port}/${DB}`;

  // The roles mirror production: migrations run as an owner, the application connects as
  // a restricted role that cannot bypass row-level security, and a separate bypass role
  // exists only so tests can seed across organisations. Testing as the owner would pass
  // while production leaked.
  const root = postgres(superUrl, { max: 1, prepare: false });
  try {
    await root.unsafe(`create role ${APP_ROLE} login password '${APP_PASSWORD}'`);
    await root.unsafe(`create role ${ADMIN_ROLE} login password '${ADMIN_PASSWORD}' bypassrls`);
    await root.unsafe(`grant all privileges on database ${DB} to ${ADMIN_ROLE}`);
  } finally {
    await root.end();
  }

  await runMigrations(superUrl, { dir: join(process.cwd(), "drizzle") });

  const after = postgres(superUrl, { max: 1, prepare: false });
  try {
    await after.unsafe(`grant rootpanther_api to ${APP_ROLE}`);
    await after.unsafe(`grant usage on schema public to ${ADMIN_ROLE}`);
    await after.unsafe(`grant all privileges on all tables in schema public to ${ADMIN_ROLE}`);
  } finally {
    await after.end();
  }

  process.env.TEST_DATABASE_URL = `postgres://${APP_ROLE}:${APP_PASSWORD}@127.0.0.1:${port}/${DB}`;
  process.env.TEST_ADMIN_URL = `postgres://${ADMIN_ROLE}:${ADMIN_PASSWORD}@127.0.0.1:${port}/${DB}`;
  process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL;

  process.env.APP_ORIGIN ??= "https://app.rootpanther.com";
  process.env.PORTAL_ORIGIN ??= "https://portal.rootpanther.com";
  process.env.API_ORIGIN ??= "https://api.rootpanther.com";
  process.env.COOKIE_DOMAIN ??= ".rootpanther.com";
  process.env.SESSION_SECRET ??= "test-session-secret-not-used-for-anything-real";
  process.env.OAUTH_GOOGLE_CLIENT_ID ??= "test-google-id";
  process.env.OAUTH_GOOGLE_CLIENT_SECRET ??= "test-google-secret";
  process.env.OAUTH_GITHUB_CLIENT_ID ??= "test-github-id";
  process.env.OAUTH_GITHUB_CLIENT_SECRET ??= "test-github-secret";
  process.env.LOG_LEVEL ??= "error";
}

export async function teardown(): Promise<void> {
  if (server) await server.stop();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
