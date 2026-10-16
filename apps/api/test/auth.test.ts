import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import postgres from "postgres";
import { AppModule } from "../src/app.module";
import { ApiExceptionFilter } from "../src/common/errors";
import { LOGGER } from "../src/config/config.module";

const admin = postgres(process.env.TEST_ADMIN_URL ?? "", { max: 1, prepare: false });

let app: NestFastifyApplication;
const unique = () => `t${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

function cookieFrom(headers: Record<string, unknown>, name: string): string | null {
  const raw = headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  for (const entry of list) {
    const [pair] = entry.split(";");
    const [key, value] = pair.split("=");
    if (key === name) return value;
  }
  return null;
}

beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  await app.register(cookie, { secret: process.env.SESSION_SECRET });
  app.useGlobalFilters(new ApiExceptionFilter(app.get(LOGGER)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
  await admin.end();
});

async function signUp(email: string, password = "correct-horse-9") {
  return app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { name: "Test Learner", email, password },
  });
}

describe("sign up", () => {
  it("creates the learner, a personal organisation and a membership", async () => {
    const email = unique();
    const res = await signUp(email);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: "authenticated" });
    expect(cookieFrom(res.headers, "rp_session")).toBeTruthy();

    const [row] = await admin`
      select u.public_id as user_public, o.public_id as org_public, o.personal, m.role
        from users u
        join memberships m on m.user_id = u.id
        join organizations o on o.id = m.org_id
       where u.email = ${email}
    `;
    expect(row.user_public).toMatch(/^usr_/);
    expect(row.org_public).toMatch(/^org_/);
    expect(row.personal).toBe(true);
    expect(row.role).toBe("learner");
  });

  it("refuses a password that is easy to guess", async () => {
    const res = await signUp(unique(), "password123");
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("validation");
  });

  it("refuses a second account on the same email", async () => {
    const email = unique();
    await signUp(email);
    const res = await signUp(email);
    expect(res.statusCode).toBe(409);
  });

  it("issues a verification token rather than trusting the address", async () => {
    const email = unique();
    await signUp(email);
    const [row] = await admin`
      select purpose from email_tokens t join users u on u.id = t.user_id
       where u.email = ${email}
    `;
    expect(row.purpose).toBe("verify_email");
  });
});

describe("sign in", () => {
  it("authenticates with the right password", async () => {
    const email = unique();
    await signUp(email);
    const res = await app.inject({
      method: "POST",
      url: "/auth/signin",
      payload: { email, password: "correct-horse-9" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: "authenticated" });
    expect(cookieFrom(res.headers, "rp_session")).toBeTruthy();
  });

  it("rejects the wrong password without issuing a session", async () => {
    const email = unique();
    await signUp(email);
    const res = await app.inject({
      method: "POST",
      url: "/auth/signin",
      payload: { email, password: "not-the-password-1" },
    });
    expect(res.statusCode).toBe(401);
    expect(cookieFrom(res.headers, "rp_session")).toBeNull();
  });

  it("answers an unknown account exactly as it answers a wrong password", async () => {
    const known = unique();
    await signUp(known);
    const wrong = await app.inject({
      method: "POST",
      url: "/auth/signin",
      payload: { email: known, password: "not-the-password-1" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/signin",
      payload: { email: unique(), password: "not-the-password-1" },
    });
    expect(unknown.statusCode).toBe(wrong.statusCode);
    expect(unknown.json().message).toBe(wrong.json().message);
  });

  it("locks the account after repeated failures", async () => {
    const email = unique();
    await signUp(email);
    let last = await signUp(email);
    for (let i = 0; i < 5; i += 1) {
      last = await app.inject({
        method: "POST",
        url: "/auth/signin",
        payload: { email, password: "still-wrong-here-1" },
      });
    }
    expect(last.json().status).toBe("locked");

    // The correct password is refused while the lock holds.
    const afterLock = await app.inject({
      method: "POST",
      url: "/auth/signin",
      payload: { email, password: "correct-horse-9" },
    });
    expect(afterLock.json().status).toBe("locked");
  });
});

describe("session", () => {
  it("accepts the issued cookie on a guarded route", async () => {
    const email = unique();
    const created = await signUp(email);
    const token = cookieFrom(created.headers, "rp_session");
    const res = await app.inject({
      method: "GET",
      url: "/auth/sessions",
      cookies: { rp_session: token ?? "" },
    });
    expect(res.statusCode).toBe(200);
    const sessions = res.json();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].current).toBe(true);
  });

  it("refuses a guarded route without a cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/sessions" });
    expect(res.statusCode).toBe(401);
    expect(res.json().correlationId).toMatch(/^req_[a-f0-9]{6}$/);
  });

  it("stops accepting the cookie after sign out", async () => {
    const email = unique();
    const created = await signUp(email);
    const token = cookieFrom(created.headers, "rp_session") ?? "";
    await app.inject({ method: "POST", url: "/auth/signout", cookies: { rp_session: token } });
    const res = await app.inject({
      method: "GET",
      url: "/auth/sessions",
      cookies: { rp_session: token },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("password reset", () => {
  it("reports the same result for a known and an unknown address", async () => {
    const known = unique();
    await signUp(known);
    const a = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { email: known },
    });
    const b = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: { email: unique() },
    });
    expect(a.statusCode).toBe(b.statusCode);
    expect(a.json()).toEqual(b.json());
  });
});

describe("the organisation a session acts in", () => {
  it("is the one created with the account, and is not another learner's", async () => {
    const mine = unique();
    const theirs = unique();
    const a = await signUp(mine);
    await signUp(theirs);

    const [session] = await admin`
      select s.active_org_id, o.public_id
        from auth_sessions s
        join users u on u.id = s.user_id
        join organizations o on o.id = s.active_org_id
       where u.email = ${mine}
    `;
    expect(session.active_org_id).toBeTruthy();
    expect(session.public_id).toMatch(/^org_/);

    const [other] = await admin`
      select m.org_id from memberships m
        join users u on u.id = m.user_id
       where u.email = ${theirs}
    `;
    expect(session.active_org_id).not.toBe(other.org_id);
    expect(cookieFrom(a.headers, "rp_session")).toBeTruthy();
  });

  it("resolves a session that predates the column rather than signing the learner out", async () => {
    const email = unique();
    const res = await signUp(email);
    const token = cookieFrom(res.headers, "rp_session") ?? "";

    // The state a session issued before 0003 is in. It has to keep working.
    await admin`
      update auth_sessions s set active_org_id = null
        from users u where u.id = s.user_id and u.email = ${email}
    `;

    const after = await app.inject({
      method: "GET",
      url: "/auth/sessions",
      cookies: { rp_session: token },
    });
    expect(after.statusCode).toBe(200);

    const [repaired] = await admin`
      select s.active_org_id from auth_sessions s
        join users u on u.id = s.user_id
       where u.email = ${email}
    `;
    expect(repaired.active_org_id).toBeTruthy();
  });
});
