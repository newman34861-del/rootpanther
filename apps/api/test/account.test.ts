import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import { AppModule } from "../src/app.module";
import { ApiExceptionFilter } from "../src/common/errors";
import { LOGGER } from "../src/config/config.module";

let app: NestFastifyApplication;
let session = "";

const unique = () => `a${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

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

beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  await app.register(cookie, { secret: process.env.SESSION_SECRET });
  app.useGlobalFilters(new ApiExceptionFilter(app.get(LOGGER)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const res = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { name: "Dana Reyes", email: unique(), password: "correct-horse-9" },
  });
  session = cookieFrom(res.headers, "rp_session") ?? "";
});

afterAll(async () => {
  await app.close();
});

describe("profile", () => {
  it("returns the account with initials derived from the name", async () => {
    const res = await app.inject({ method: "GET", url: "/account/profile", headers: as(session) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Dana Reyes");
    expect(body.initials).toBe("DR");
    expect(body.emailVerified).toBe(false);
    expect(body.handle).toBeNull();
  });

  it("refuses without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/account/profile" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("unauthenticated");
  });

  it("updates the name without blanking the fields it was not sent", async () => {
    await app.inject({
      method: "PATCH",
      url: "/account/profile",
      headers: as(session),
      payload: { name: "Dana Reyes", country: "GB" },
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/account/profile",
      headers: as(session),
      payload: { name: "Dana R Reyes" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Dana R Reyes");
    expect(res.json().country).toBe("GB");
  });
});

describe("handle", () => {
  it("refuses a reserved handle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/account/handle?value=support",
      headers: as(session),
    });
    expect(res.json()).toEqual({ handle: "support", available: false, reason: "reserved" });
  });

  it("refuses a malformed handle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/account/handle?value=Not%20A%20Handle",
      headers: as(session),
    });
    expect(res.json().reason).toBe("malformed");
  });

  it("accepts a free handle, then reports it taken for someone else", async () => {
    const wanted = `dana-${Date.now()}`;
    const free = await app.inject({
      method: "GET",
      url: `/account/handle?value=${wanted}`,
      headers: as(session),
    });
    expect(free.json().available).toBe(true);

    await app.inject({
      method: "PATCH",
      url: "/account/profile",
      headers: as(session),
      payload: { name: "Dana R Reyes", handle: wanted },
    });

    const other = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { name: "Other Learner", email: unique(), password: "correct-horse-9" },
    });
    const otherSession = cookieFrom(other.headers, "rp_session") ?? "";
    const taken = await app.inject({
      method: "GET",
      url: `/account/handle?value=${wanted}`,
      headers: as(otherSession),
    });
    expect(taken.json()).toEqual({ handle: wanted, available: false, reason: "taken" });

    const conflict = await app.inject({
      method: "PATCH",
      url: "/account/profile",
      headers: as(otherSession),
      payload: { name: "Other Learner", handle: wanted },
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("does not let two accounts differ only in case", async () => {
    const wanted = `case-${Date.now()}`;
    await app.inject({
      method: "PATCH",
      url: "/account/profile",
      headers: as(session),
      payload: { name: "Dana R Reyes", handle: wanted },
    });

    const other = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { name: "Third Learner", email: unique(), password: "correct-horse-9" },
    });
    const otherSession = cookieFrom(other.headers, "rp_session") ?? "";
    const res = await app.inject({
      method: "GET",
      url: `/account/handle?value=${wanted.toUpperCase()}`,
      headers: as(otherSession),
    });
    expect(res.json().reason).toBe("taken");
  });
});

describe("preferences", () => {
  it("returns defaults before anything is saved", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/account/preferences",
      headers: as(session),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().helpDefault).toBe("nudge");
    expect(res.json().terminalFontSize).toBe(14);
  });

  it("round-trips what it was given", async () => {
    const wanted = {
      helpDefault: "coach",
      terminalFontSize: 18,
      terminalTheme: "paper",
      email: { sessionExpiry: false, debriefReady: true, newScenarios: true, billing: false },
    };
    const put = await app.inject({
      method: "PUT",
      url: "/account/preferences",
      headers: as(session),
      payload: wanted,
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual(wanted);

    const get = await app.inject({
      method: "GET",
      url: "/account/preferences",
      headers: as(session),
    });
    expect(get.json()).toEqual(wanted);
  });

  it("refuses a font size outside the range the terminal supports", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/account/preferences",
      headers: as(session),
      payload: {
        helpDefault: "nudge",
        terminalFontSize: 40,
        terminalTheme: "paper",
        email: { sessionExpiry: true, debriefReady: true, newScenarios: true, billing: true },
      },
    });
    expect(res.statusCode).toBe(422);
  });
});

describe("lab defaults", () => {
  it("defaults to openvpn, which is what the exam uses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/account/lab-defaults",
      headers: as(session),
    });
    expect(res.json()).toEqual({ connection: "openvpn", teardown: "idle", sshKey: null });
  });

  it("accepts a public key and strips the stray whitespace a paste carries", async () => {
    const key =
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBx4LwsGRmL4Y1X+zt1Bfpkl+hstUO29CLp3oVILf+3T dana@kali";
    const res = await app.inject({
      method: "PUT",
      url: "/account/lab-defaults",
      headers: as(session),
      payload: { connection: "openvpn", teardown: "leave", sshKey: `  ${key}\n` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sshKey).toBe(key);
    expect(res.json().teardown).toBe("leave");
  });

  it("names the mistake when a private key is pasted", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/account/lab-defaults",
      headers: as(session),
      payload: {
        connection: "openvpn",
        teardown: "idle",
        sshKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaA==\n-----END OPENSSH PRIVATE KEY-----",
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().fields.sshKey).toContain(".pub");
  });

  it("refuses something that is not a key at all", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/account/lab-defaults",
      headers: as(session),
      payload: { connection: "openvpn", teardown: "idle", sshKey: "hello" },
    });
    expect(res.statusCode).toBe(422);
  });
});
