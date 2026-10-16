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

const unique = () => `p${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

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

async function newLearner() {
  const email = unique();
  const res = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { name: "Dana Reyes", email, password: "correct-horse-9" },
  });
  const session = cookieFrom(res.headers, "rp_session") ?? "";
  const [ids] = await admin`
    select m.org_id, m.user_id from memberships m
      join users u on u.id = m.user_id where u.email = ${email}
  `;
  return { session, orgId: ids.org_id as string, userId: ids.user_id as string };
}

async function complete(learner: { orgId: string; userId: string }, slug: string) {
  await admin`
    insert into scenario_progress (org_id, user_id, scenario_id, status, attempts, last_attempt_at)
    select ${learner.orgId}, ${learner.userId}, id, 'completed', 1, now()
      from scenarios where slug = ${slug}
    on conflict (org_id, user_id, scenario_id) do update set status = 'completed'
  `;
}

function path(session: string) {
  return app.inject({ method: "GET", url: "/path", headers: { cookie: `rp_session=${session}` } });
}

function declare(session: string, tier: string) {
  return app.inject({
    method: "PUT",
    url: "/path/tier",
    headers: { cookie: `rp_session=${session}` },
    payload: { tier },
  });
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

describe("the ladder", () => {
  it("starts a new learner at C1 with nothing passed", async () => {
    const { session } = await newLearner();
    const body = (await path(session)).json();
    expect(body.tier).toBe("C1");
    expect(body.ladder).toEqual([
      { tier: "C1", state: "current" },
      { tier: "C2", state: "next" },
      { tier: "C3", state: "locked" },
      { tier: "C4", state: "locked" },
    ]);
  });

  it("says no rule exists for a step nobody has decided, rather than inventing one", async () => {
    const { session } = await newLearner();
    const body = (await path(session)).json();
    expect(body.advancement).toEqual({
      from: "C1",
      to: "C2",
      defined: false,
      eligible: false,
      criteria: [],
    });
  });

  it("moves when the learner declares a tier", async () => {
    const { session } = await newLearner();
    const res = await declare(session, "C3");
    expect(res.statusCode).toBe(200);
    expect(res.json().ladder.map((s: { state: string }) => s.state)).toEqual([
      "passed",
      "passed",
      "current",
      "next",
    ]);
  });

  it("has nowhere further to go at C4", async () => {
    const { session } = await newLearner();
    const body = (await declare(session, "C4")).json();
    expect(body.advancement).toBeNull();
  });

  it("keeps the date when the same tier is declared again", async () => {
    const { session } = await newLearner();
    const first = (await declare(session, "C2")).json();
    const again = (await declare(session, "C2")).json();
    expect(again.since).toBe(first.since);
  });

  it("refuses a tier that does not exist", async () => {
    const { session } = await newLearner();
    expect((await declare(session, "C9")).statusCode).toBe(422);
  });
});

describe("C2 to C3", () => {
  it("lists the three criteria, two of them pending until their data exists", async () => {
    const { session } = await newLearner();
    await declare(session, "C2");
    const adv = (await path(session)).json().advancement;
    expect(adv.defined).toBe(true);
    expect(adv.to).toBe("C3");
    expect(adv.criteria.map((c: { id: string; state: string }) => [c.id, c.state])).toEqual([
      ["c2-finishes", "unmet"],
      ["c2-solo", "pending"],
      ["c2-report", "pending"],
    ]);
    expect(adv.criteria[1].pendingReason).toBeTruthy();
    expect(adv.criteria[0].progress).toEqual({ done: 0, of: 3 });
    expect(adv.criteria[0].scenarios.map((s: { slug: string }) => s.slug).sort()).toEqual([
      "granite",
      "meridian",
      "tamarack",
    ]);
  });

  it("counts finished C2 scenarios and ignores those at other tiers", async () => {
    const learner = await newLearner();
    await declare(learner.session, "C2");
    await complete(learner, "meridian");
    await complete(learner, "obsidian");

    const finishes = (await path(learner.session)).json().advancement.criteria[0];
    expect(finishes.progress).toEqual({ done: 1, of: 3 });
    expect(finishes.state).toBe("unmet");
    expect(finishes.evidence).toBe("Finished Meridian");
  });

  it("meets the finishes criterion at three, but is not eligible while anything is pending", async () => {
    const learner = await newLearner();
    await declare(learner.session, "C2");
    for (const slug of ["meridian", "tamarack", "granite"]) await complete(learner, slug);

    const adv = (await path(learner.session)).json().advancement;
    expect(adv.criteria[0].state).toBe("met");
    expect(adv.criteria[0].progress).toEqual({ done: 3, of: 3 });
    // The rule is three things, and one met while two cannot be judged is not a promotion.
    expect(adv.eligible).toBe(false);
  });

  it("never counts another learner's finishes", async () => {
    const mine = await newLearner();
    const theirs = await newLearner();
    await declare(mine.session, "C2");
    await declare(theirs.session, "C2");
    for (const slug of ["meridian", "tamarack", "granite"]) await complete(theirs, slug);

    const adv = (await path(mine.session)).json().advancement;
    expect(adv.criteria[0].progress).toEqual({ done: 0, of: 3 });
  });
});

describe("skills", () => {
  it("is empty for a learner who has done nothing", async () => {
    const { session } = await newLearner();
    const groups = (await path(session)).json().skills;
    expect(groups.map((g: { id: string }) => g.id)).toEqual(["foothold", "privesc", "ad"]);
    for (const g of groups) {
      for (const row of g.rows) {
        expect(row.completed).toBe(0);
        expect(row.strength).toBe(0);
        expect(row.lastPractised).toBeNull();
      }
    }
  });

  it("credits each technique a finished scenario teaches", async () => {
    const learner = await newLearner();
    await complete(learner, "meridian");
    const groups = (await path(learner.session)).json().skills;
    const ad = groups.find((g: { id: string }) => g.id === "ad");
    const row = (t: string) => ad.rows.find((r: { technique: string }) => r.technique === t);

    expect(row("kerberoasting").completed).toBe(1);
    expect(row("kerberoasting").strength).toBeCloseTo(1 / 3);
    expect(row("kerberoasting").lastPractised).toBeTruthy();
    expect(row("delegation").completed).toBe(0);
    // Not verified: that needs a captured proof, which lab sessions have not produced.
    expect(row("kerberoasting").verified).toBe(false);
  });
});
