import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as identity from "./schema/identity";

export const schema = { ...identity };

export type Database = ReturnType<typeof createDatabase>["db"];
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function createDatabase(url: string, poolMax: number) {
  const client = postgres(url, {
    max: poolMax,
    // Prepared statements are disabled because PgBouncer in transaction mode cannot
    // carry them across a pooled connection.
    prepare: false,
  });
  const db = drizzle(client, { schema });
  return { client, db };
}
