import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * The isolation guarantee, asserted against a real Postgres.
 *
 * These run as the restricted application role, not as the owner, because a table owner
 * bypasses row-level security unless it is forced and a superuser bypasses it always.
 * Testing as the owner would pass while production leaked.
 */

const adminUrl = process.env.TEST_ADMIN_URL;
const appUrl = process.env.TEST_DATABASE_URL;

const admin = postgres(adminUrl ?? "", { max: 1, prepare: false });
const app = postgres(appUrl ?? "", { max: 1, prepare: false });

let orgA = "";
let orgB = "";

beforeAll(async () => {
  const [a] = await admin`
    insert into organizations (public_id, name) values ('org_a', 'Org A') returning id
  `;
  const [b] = await admin`
    insert into organizations (public_id, name) values ('org_b', 'Org B') returning id
  `;
  orgA = a.id;
  orgB = b.id;

  const [ua] = await admin`
    insert into users (public_id, email, name) values ('usr_aaaaaa', 'a@example.com', 'A') returning id
  `;
  const [ub] = await admin`
    insert into users (public_id, email, name) values ('usr_bbbbbb', 'b@example.com', 'B') returning id
  `;
  await admin`insert into memberships (org_id, user_id) values (${orgA}, ${ua.id})`;
  await admin`insert into memberships (org_id, user_id) values (${orgB}, ${ub.id})`;
});

afterAll(async () => {
  await admin`delete from organizations where public_id in ('org_a','org_b')`;
  await admin`delete from users where public_id in ('usr_aaaaaa','usr_bbbbbb')`;
  await admin.end();
  await app.end();
});

describe("organisation isolation", () => {
  it("shows only the scoped organisation's memberships", async () => {
    const rows = await app.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${orgA}, true)`;
      return tx`select org_id from memberships`;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].org_id).toBe(orgA);
  });

  it("returns nothing when no organisation is scoped", async () => {
    const rows = await app.begin(async (tx) => tx`select org_id from memberships`);
    expect(rows).toHaveLength(0);
  });

  it("does not leak the other organisation even when asked for it directly", async () => {
    const rows = await app.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${orgA}, true)`;
      return tx`select org_id from memberships where org_id = ${orgB}`;
    });
    expect(rows).toHaveLength(0);
  });

  it("refuses to write a row into another organisation", async () => {
    const [u] = await admin`
      insert into users (public_id, email, name)
      values ('usr_cccccc', 'c@example.com', 'C') returning id
    `;
    await expect(
      app.begin(async (tx) => {
        await tx`select set_config('app.org_id', ${orgA}, true)`;
        return tx`insert into memberships (org_id, user_id) values (${orgB}, ${u.id})`;
      }),
    ).rejects.toThrow();
    await admin`delete from users where public_id = 'usr_cccccc'`;
  });

  it("does not let the scope leak between pooled transactions", async () => {
    await app.begin(async (tx) => {
      await tx`select set_config('app.org_id', ${orgA}, true)`;
      return tx`select 1`;
    });
    const rows = await app.begin(async (tx) => tx`select org_id from memberships`);
    expect(rows).toHaveLength(0);
  });

  it("runs as a role that cannot bypass row level security", async () => {
    const [row] = await app`
      select rolsuper, rolbypassrls from pg_roles where rolname = current_user
    `;
    expect(row.rolsuper).toBe(false);
    expect(row.rolbypassrls).toBe(false);
  });
});
