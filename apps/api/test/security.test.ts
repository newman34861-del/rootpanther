import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import * as OTPAuth from "otpauth";
import { AppModule } from "../src/app.module";
import { ApiExceptionFilter } from "../src/common/errors";
import { LOGGER } from "../src/config/config.module";

let app: NestFastifyApplication;

const unique = () => `s${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
const PASSWORD = "correct-horse-9";

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

function as(session: string) {
  return { cookie: `rp_session=${session}` };
}

async function newLearner(): Promise<{ email: string; session: string }> {
  const email = unique();
  const res = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { name: "Dana Reyes", email, password: PASSWORD },
  });
  return { email, session: cookieFrom(res.headers, "rp_session") ?? "" };
}

async function signIn(email: string, password = PASSWORD) {
  return app.inject({ method: "POST", url: "/auth/signin", payload: { email, password } });
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
});

describe("security state", () => {
  it("reports the password, no second factor and the current device", async () => {
    const { session } = await newLearner();
    const res = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.hasPassword).toBe(true);
    expect(body.passwordChangedAt).toBeTruthy();
    expect(body.twoFactor).toEqual({ enabled: false, enabledAt: null, codesLeft: 0 });
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].current).toBe(true);
    expect(body.accounts.map((a: { provider: string }) => a.provider)).toEqual([
      "google",
      "microsoft",
      "github",
    ]);
  });
});

describe("changing the password", () => {
  it("refuses without the current one", async () => {
    const { session } = await newLearner();
    const res = await app.inject({
      method: "POST",
      url: "/account/security/password",
      headers: as(session),
      payload: { newPassword: "another-good-one-7" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().fields.currentPassword).toBeTruthy();
  });

  it("refuses a new password that is easy to guess", async () => {
    const { session } = await newLearner();
    const res = await app.inject({
      method: "POST",
      url: "/account/security/password",
      headers: as(session),
      payload: { currentPassword: PASSWORD, newPassword: "password1234" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("changes it and signs the other devices out, keeping this one", async () => {
    const { email, session } = await newLearner();
    const second = await signIn(email);
    const secondSession = cookieFrom(second.headers, "rp_session") ?? "";

    const before = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(before.json().sessions).toHaveLength(2);

    const res = await app.inject({
      method: "POST",
      url: "/account/security/password",
      headers: as(session),
      payload: { currentPassword: PASSWORD, newPassword: "a-different-one-4" },
    });
    expect(res.statusCode).toBe(201);

    const stillHere = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(stillHere.statusCode).toBe(200);
    expect(stillHere.json().sessions).toHaveLength(1);

    const evicted = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(secondSession),
    });
    expect(evicted.statusCode).toBe(401);

    expect((await signIn(email, PASSWORD)).statusCode).toBe(401);
    expect((await signIn(email, "a-different-one-4")).statusCode).toBe(201);
  });
});

describe("devices", () => {
  it("revokes one device without touching the rest", async () => {
    const { email, session } = await newLearner();
    await signIn(email);
    const listed = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    const other = listed.json().sessions.find((s: { current: boolean }) => !s.current);

    const res = await app.inject({
      method: "DELETE",
      url: `/account/security/sessions/${other.id}`,
      headers: as(session),
    });
    expect(res.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(after.json().sessions).toHaveLength(1);
  });

  it("will not revoke a device belonging to someone else", async () => {
    const mine = await newLearner();
    const theirs = await newLearner();
    const listed = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(theirs.session),
    });
    const theirDevice = listed.json().sessions[0].id;

    const res = await app.inject({
      method: "DELETE",
      url: `/account/security/sessions/${theirDevice}`,
      headers: as(mine.session),
    });
    expect(res.statusCode).toBe(404);

    const unharmed = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(theirs.session),
    });
    expect(unharmed.statusCode).toBe(200);
  });
});

describe("two factor", () => {
  it("is not in force until a code proves the authenticator holds the secret", async () => {
    const { session } = await newLearner();
    const begin = await app.inject({
      method: "POST",
      url: "/account/security/2fa",
      headers: as(session),
    });
    expect(begin.statusCode).toBe(201);
    expect(begin.json().otpauth).toContain("otpauth://totp/Rootpanther:");

    const stillOff = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(stillOff.json().twoFactor.enabled).toBe(false);

    const wrong = await app.inject({
      method: "POST",
      url: "/account/security/2fa/confirm",
      headers: as(session),
      payload: { code: "000000" },
    });
    expect(wrong.statusCode).toBe(422);

    const totp = new OTPAuth.TOTP({
      issuer: "Rootpanther",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(begin.json().secret),
    });
    const confirmed = await app.inject({
      method: "POST",
      url: "/account/security/2fa/confirm",
      headers: as(session),
      payload: { code: totp.generate() },
    });
    expect(confirmed.statusCode).toBe(201);
    expect(confirmed.json().codes).toHaveLength(10);

    const on = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(on.json().twoFactor.enabled).toBe(true);
    expect(on.json().twoFactor.codesLeft).toBe(10);
  });

  it("will not turn off without the password", async () => {
    const { session } = await newLearner();
    const begin = await app.inject({
      method: "POST",
      url: "/account/security/2fa",
      headers: as(session),
    });
    const totp = new OTPAuth.TOTP({
      issuer: "Rootpanther",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(begin.json().secret),
    });
    const confirmed = await app.inject({
      method: "POST",
      url: "/account/security/2fa/confirm",
      headers: as(session),
      payload: { code: totp.generate() },
    });
    expect(confirmed.statusCode).toBe(201);
    // Asserted before the refusal below, because a refusal to turn off something that
    // was never on proves nothing.
    const armed = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(armed.json().twoFactor.enabled).toBe(true);

    const refused = await app.inject({
      method: "DELETE",
      url: "/account/security/2fa",
      headers: as(session),
      payload: {},
    });
    expect(refused.statusCode).toBe(401);

    const removed = await app.inject({
      method: "DELETE",
      url: "/account/security/2fa",
      headers: as(session),
      payload: { currentPassword: PASSWORD },
    });
    expect(removed.statusCode).toBe(200);

    const off = await app.inject({
      method: "GET",
      url: "/account/security",
      headers: as(session),
    });
    expect(off.json().twoFactor.enabled).toBe(false);
    expect(off.json().twoFactor.codesLeft).toBe(0);
  });

  it("will not hand out recovery codes when two factor is off", async () => {
    const { session } = await newLearner();
    const res = await app.inject({
      method: "POST",
      url: "/account/security/2fa/recovery-codes",
      headers: as(session),
    });
    expect(res.statusCode).toBe(409);
  });
});
