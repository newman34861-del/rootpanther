import { sql } from "drizzle-orm";
import type { Database, Tx } from "./client";

/**
 * Runs a unit of work scoped to one organisation.
 *
 * Row-level security compares org_id to current_setting('app.org_id'). The setting is
 * transaction-local, so a connection returned to the pool never carries a previous
 * request's scope. Code that forgets to scope sees nothing rather than everything,
 * which is the behaviour we want when someone makes a mistake.
 */
export async function withOrg<T>(db: Database, orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

/**
 * Runs a unit of work that deliberately crosses organisations, for operator surfaces
 * such as the fleet view or the user list.
 *
 * This is the only way to read across tenants and it is not ambient: the caller must
 * name a reason, which is written to the audit log by the operator layer. Keeping the
 * bypass explicit is what stops it spreading into ordinary request paths.
 */
export async function withoutOrgScope<T>(
  db: Database,
  reason: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!reason.trim()) throw new Error("withoutOrgScope requires a reason");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.cross_org', 'on', true)`);
    return fn(tx);
  });
}
