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
let session = "";
let email = "";

const unique = () => `c${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

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

function as(token: string) {
  return { cookie: `rp_session=${token}` };
}

async function newLearner(): Promise<{ email: string; session: string }> {
  const address = unique();
  const res = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { name: "Dana Reyes", email: address, password: "correct-horse-9" },
  });
  return { email: address, session: cookieFrom(res.headers, "rp_session") ?? "" };
}

async function get(url: string, token = session) {
  return app.inject({ method: "GET", url, headers: as(token) });
}

beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  await app.register(cookie, { secret: process.env.SESSION_SECRET });
  app.useGlobalFilters(new ApiExceptionFilter(app.get(LOGGER)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const learner = await newLearner();
  email = learner.email;
  session = learner.session;
});

afterAll(async () => {
  await app.close();
  await admin.end();
});

describe("the catalogue list", () => {
  it("returns the published scenarios", async () => {
    const res = await get("/catalogue");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(4);
    expect(body.scenarios.map((s: { slug: string }) => s.slug).sort()).toEqual([
      "granite",
      "meridian",
      "obsidian",
      "tamarack",
    ]);
  });

  it("refuses without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/catalogue" });
    expect(res.statusCode).toBe(401);
  });

  it("does not list a scenario that is not published", async () => {
    await admin`update scenarios set status = 'draft' where slug = 'tamarack'`;
    try {
      const res = await get("/catalogue");
      expect(res.json().total).toBe(3);
      expect(res.json().scenarios.map((s: { slug: string }) => s.slug)).not.toContain("tamarack");

      const detail = await get("/catalogue/tamarack");
      expect(detail.statusCode).toBe(404);
    } finally {
      await admin`update scenarios set status = 'published' where slug = 'tamarack'`;
    }
  });
});

describe("filtering", () => {
  it("narrows by type", async () => {
    const res = await get("/catalogue?type=exam-sim");
    expect(res.json().total).toBe(2);
    expect(res.json().scenarios.every((s: { type: string }) => s.type === "exam-sim")).toBe(true);
  });

  it("treats two values in one dimension as either", async () => {
    const res = await get("/catalogue?type=exam-sim,standalone");
    expect(res.json().total).toBe(3);
  });

  it("treats two dimensions as both", async () => {
    const res = await get("/catalogue?type=exam-sim&tier=C3");
    expect(res.json().total).toBe(1);
    expect(res.json().scenarios[0].slug).toBe("obsidian");
  });

  it("accepts a repeated parameter as well as a comma list", async () => {
    const repeated = await get("/catalogue?type=exam-sim&type=standalone");
    const comma = await get("/catalogue?type=exam-sim,standalone");
    expect(repeated.json().total).toBe(comma.json().total);
  });

  it("matches a technique against the ones the scenario teaches", async () => {
    const res = await get("/catalogue?technique=delegation");
    expect(res.json().scenarios.map((s: { slug: string }) => s.slug)).toEqual(["obsidian"]);
  });

  it("buckets by duration", async () => {
    const short = await get("/catalogue?duration=under-2h");
    expect(short.json().total).toBe(0);
    const long = await get("/catalogue?duration=over-4h");
    expect(long.json().total).toBe(2);
  });

  it("refuses a value that is not one of the options", async () => {
    const res = await get("/catalogue?type=nonsense");
    expect(res.statusCode).toBe(422);
  });

  it("searches name, domain, objective and summary", async () => {
    expect((await get("/catalogue?q=meridian")).json().total).toBe(1);
    expect((await get("/catalogue?q=domain+admin")).json().total).toBe(1);
    const every = await get("/catalogue?q=exam%20points");
    expect(every.json().total).toBe(2);
  });
});

describe("facets", () => {
  it("counts every option when nothing is selected", async () => {
    const facets = (await get("/catalogue")).json().facets;
    const byValue = Object.fromEntries(
      facets.type.map((f: { value: string; count: number }) => [f.value, f.count]),
    );
    expect(byValue).toEqual({ "ad-set": 1, standalone: 1, "exam-sim": 2 });
  });

  it("counts a dimension as if its own filter were not applied", async () => {
    const res = await get("/catalogue?type=exam-sim");
    const facets = res.json().facets;
    // The result is narrowed to two, but the type counts still show what ticking a
    // different box would give. A panel that zeroed them could not be used to explore.
    const byValue = Object.fromEntries(
      facets.type.map((f: { value: string; count: number }) => [f.value, f.count]),
    );
    expect(byValue).toEqual({ "ad-set": 1, standalone: 1, "exam-sim": 2 });

    // Other dimensions are narrowed by the type filter, which is the point of showing
    // them: within exam sims, C2 and C3 have one each and nothing else has any.
    const tiers = Object.fromEntries(
      facets.tier.map((f: { value: string; count: number }) => [f.value, f.count]),
    );
    expect(tiers).toEqual({ C1: 0, C2: 1, C3: 1, C4: 0 });
  });

  it("reports every option even when the count is zero", async () => {
    const facets = (await get("/catalogue")).json().facets;
    expect(facets.status).toHaveLength(3);
    expect(facets.duration).toHaveLength(3);
    expect(facets.hosts).toHaveLength(3);
    expect(facets.tier).toHaveLength(4);
  });
});

describe("sorting and paging", () => {
  it("sorts by duration, shortest first", async () => {
    const res = await get("/catalogue?sort=duration");
    const minutes = res.json().scenarios.map((s: { estMinutes: number }) => s.estMinutes);
    expect(minutes).toEqual([...minutes].sort((a: number, b: number) => a - b));
  });

  it("sorts by newest", async () => {
    const res = await get("/catalogue?sort=newest");
    const dates = res.json().scenarios.map((s: { publishedAt: string }) => s.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(res.json().scenarios[0].slug).toBe("obsidian");
  });

  it("puts the learner's own tier before the others when recommending", async () => {
    const [row] = await admin`
      select m.org_id, m.user_id from memberships m
        join users u on u.id = m.user_id where u.email = ${email}
    `;
    await admin`
      insert into learner_tier (org_id, user_id, tier)
      values (${row.org_id}, ${row.user_id}, 'C3')
      on conflict (org_id, user_id) do update set tier = 'C3'
    `;
    try {
      const res = await get("/catalogue?sort=recommended");
      expect(res.json().scenarios[0].tier).toBe("C3");
    } finally {
      await admin`delete from learner_tier where user_id = ${row.user_id}`;
    }
  });

  it("pages without losing the total", async () => {
    const res = await get("/catalogue?perPage=2&page=2&sort=duration");
    const body = res.json();
    expect(body.total).toBe(4);
    expect(body.page).toBe(2);
    expect(body.scenarios).toHaveLength(2);

    const first = await get("/catalogue?perPage=2&page=1&sort=duration");
    const overlap = first
      .json()
      .scenarios.map((s: { slug: string }) => s.slug)
      .filter((slug: string) => body.scenarios.some((s: { slug: string }) => s.slug === slug));
    expect(overlap).toEqual([]);
  });
});

describe("scenario detail", () => {
  it("returns the hosts, links, credential and prerequisites", async () => {
    const res = await get("/catalogue/meridian");
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.name).toBe("Meridian");
    expect(s.hosts.map((h: { id: string }) => h.id)).toEqual([
      "mer-web01",
      "mer-sql01",
      "mer-dc01",
    ]);
    expect(s.hosts[0].ports).toEqual([80, 135, 445, 5985]);
    expect(s.hosts[0].proofs).toEqual(["local", "proof"]);
    expect(s.links).toEqual([
      { from: "mer-web01", to: "mer-sql01", label: "pivot" },
      { from: "mer-sql01", to: "mer-dc01" },
    ]);
    expect(s.credential).toEqual({ username: "MERIDIAN\\j.harlow", password: "Autumn#2026" });
    expect(s.prerequisites).toHaveLength(2);
    expect(s.teaches).toHaveLength(5);
    expect(s.proofRequirements).toHaveLength(3);
  });

  it("keeps the order the brief was authored in", async () => {
    const s = (await get("/catalogue/meridian")).json();
    expect(s.teaches[0]).toContain("Enumerate a domain");
    expect(s.proofRequirements[2]).toContain("domain controller");
  });

  it("reports an unknown slug as missing", async () => {
    const res = await get("/catalogue/not-a-scenario");
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("not-found");
  });
});

describe("progress", () => {
  it("defaults to not-started and carries no history", async () => {
    const s = (await get("/catalogue/meridian")).json();
    expect(s.status).toBe("not-started");
    expect(s.history).toBeUndefined();
  });

  it("shows this learner's progress and never another's", async () => {
    const theirs = await newLearner();
    const [mine] = await admin`
      select m.org_id, m.user_id from memberships m
        join users u on u.id = m.user_id where u.email = ${email}
    `;
    const [scenario] = await admin`select id from scenarios where slug = 'meridian'`;

    await admin`
      insert into scenario_progress (
        org_id, user_id, scenario_id, status, attempts, proofs_captured, proofs_total
      ) values (${mine.org_id}, ${mine.user_id}, ${scenario.id}, 'in-progress', 2, 2, 4)
    `;
    try {
      const ours = (await get("/catalogue/meridian")).json();
      expect(ours.status).toBe("in-progress");
      expect(ours.history).toEqual({ attempts: 2, proofsCaptured: 2, proofsTotal: 4 });

      // The same scenario, read by a different learner in a different organisation.
      const other = (await get("/catalogue/meridian", theirs.session)).json();
      expect(other.status).toBe("not-started");
      expect(other.history).toBeUndefined();

      const filtered = await get("/catalogue?status=in-progress");
      expect(filtered.json().total).toBe(1);
      const theirFiltered = await get("/catalogue?status=in-progress", theirs.session);
      expect(theirFiltered.json().total).toBe(0);
    } finally {
      await admin`delete from scenario_progress where user_id = ${mine.user_id}`;
    }
  });
});
