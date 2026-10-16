import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import postgres from "postgres";
import { AppModule } from "../src/app.module";
import { ApiExceptionFilter } from "../src/common/errors";
import { LOGGER } from "../src/config/config.module";
import { OauthService } from "../src/modules/auth/oauth/oauth.service";
import type { ProviderProfile } from "../src/modules/auth/oauth/providers";

const admin = postgres(process.env.TEST_ADMIN_URL ?? "", { max: 1, prepare: false });

let app: NestFastifyApplication;
let oauth: OauthService;

const unique = () => `o${Date.now()}${Math.floor(Math.random() * 10000)}@example.com`;

function profile(over: Partial<ProviderProfile> = {}): ProviderProfile {
  return {
    providerAccountId: `acct-${Math.random().toString(36).slice(2)}`,
    email: unique(),
    emailVerified: true,
    name: "Provider User",
    label: "provider-user",
    ...over,
  };
}

beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  await app.register(cookie, { secret: process.env.SESSION_SECRET });
  app.useGlobalFilters(new ApiExceptionFilter(app.get(LOGGER)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  oauth = app.get(OauthService);
});

afterAll(async () => {
  await app.close();
  await admin.end();
});

describe("account resolution", () => {
  it("creates an account and a personal organisation for a new verified identity", async () => {
    const p = profile();
    const out = await oauth.resolve("google", p);
    expect(out.created).toBe(true);

    const [row] = await admin`
      select o.personal, m.role, u.email_verified_at
        from users u
        join memberships m on m.user_id = u.id
        join organizations o on o.id = m.org_id
       where u.email = ${p.email!.toLowerCase()}
    `;
    expect(row.personal).toBe(true);
    expect(row.role).toBe("learner");
    expect(row.email_verified_at).not.toBeNull();
  });

  it("signs in the same identity on a second visit rather than duplicating it", async () => {
    const p = profile();
    const first = await oauth.resolve("google", p);
    const second = await oauth.resolve("google", p);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
  });

  it("attaches to an existing account when the provider verified the address", async () => {
    const p = profile();
    const first = await oauth.resolve("google", p);
    // A different provider account, same verified address.
    const other = profile({ email: p.email, providerAccountId: "different-account" });
    const second = await oauth.resolve("github", other);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
  });

  it("refuses to attach to an existing account on an unverified address", async () => {
    const p = profile();
    await oauth.resolve("google", p);
    const spoofed = profile({
      email: p.email,
      emailVerified: false,
      providerAccountId: "attacker-account",
    });
    await expect(oauth.resolve("github", spoofed)).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses an identity with no usable address", async () => {
    await expect(
      oauth.resolve("github", profile({ email: null, emailVerified: false })),
    ).rejects.toMatchObject({ code: "validation" });
  });
});

describe("unlinking", () => {
  it("refuses to remove the only way to sign in", async () => {
    const out = await oauth.resolve("google", profile());
    await expect(oauth.unlink(out.userId, "google")).rejects.toMatchObject({ code: "conflict" });
  });

  it("allows removal when another provider remains", async () => {
    const p = profile();
    const out = await oauth.resolve("google", p);
    await oauth.link(out.userId, "github", profile({ email: p.email }));
    await oauth.unlink(out.userId, "google");
    const accounts = await oauth.listFor(out.userId);
    expect(accounts.find((a) => a.provider === "google")?.linked).toBe(false);
    expect(accounts.find((a) => a.provider === "github")?.linked).toBe(true);
  });
});

describe("callback hardening", () => {
  it("rejects an unknown provider", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/oauth/facebook/start" });
    expect(res.statusCode).toBe(404);
  });

  it("sends the learner back with an error when no state cookie is present", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/oauth/google/callback?code=abc&state=xyz",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("error=expired");
  });

  it("rejects a forged state value", async () => {
    const start = await app.inject({ method: "GET", url: "/auth/oauth/google/start" });
    const setCookie = start.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie ?? "");
    const value = raw.split("rp_oauth=")[1]?.split(";")[0] ?? "";

    const res = await app.inject({
      method: "GET",
      url: "/auth/oauth/google/callback?code=abc&state=not-the-issued-state",
      cookies: { rp_oauth: decodeURIComponent(value) },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("error=state");
  });

  it("requires a session to list connected accounts", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/oauth/accounts" });
    expect(res.statusCode).toBe(401);
  });
});
