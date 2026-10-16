import { Inject, Injectable } from "@nestjs/common";
import {
  TIER_ORDER,
  type CatalogueFacets,
  type CatalogueQuery,
  type CatalogueResponse,
  type FacetCount,
  type Host,
  type Scenario,
  type TierCode,
} from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { ApiException } from "../../common/errors";
import type { Database, Tx } from "../../db/client";
import { DB } from "../../db/db.module";
import { withOrg } from "../../db/tenancy";

type ScenarioRow = {
  id: string;
  slug: string;
  name: string;
  type: Scenario["type"];
  tier: TierCode;
  objective: string;
  domain: string;
  os: Scenario["os"];
  est_minutes: number;
  host_count: number;
  difficulty: number;
  summary: string;
  published_at: Date;
  techniques: Scenario["techniques"];
  teaches: string[];
  proof_requirements: string[];
  prerequisites: Scenario["prerequisites"];
  progress_status: Scenario["status"];
  attempts: number | null;
  best_minutes: number | null;
  proofs_captured: number | null;
  proofs_total: number | null;
  last_attempt_at: Date | null;
  debrief_id: string | null;
};

type HostRow = {
  scenario_id: string;
  host_key: string;
  name: string;
  ip: string;
  os: Host["os"];
  role: string;
  exposure: Host["exposure"];
  ports: number[];
  proofs: Host["proofs"];
};

type LinkRow = { scenario_id: string; from_key: string; to_key: string; label: string | null };

/** The filter dimensions, each a predicate over a loaded scenario. */
const DIMENSIONS = {
  type: (s: Scenario, v: string) => s.type === v,
  tier: (s: Scenario, v: string) => s.tier === v,
  technique: (s: Scenario, v: string) => (s.techniques as string[]).includes(v),
  os: (s: Scenario, v: string) => s.os === v,
  status: (s: Scenario, v: string) => s.status === v,
  duration: (s: Scenario, v: string) =>
    v === "under-2h"
      ? s.estMinutes < 120
      : v === "2h-4h"
        ? s.estMinutes >= 120 && s.estMinutes <= 240
        : s.estMinutes > 240,
  hosts: (s: Scenario, v: string) =>
    v === "1" ? s.hostCount === 1 : v === "2-3" ? s.hostCount >= 2 && s.hostCount <= 3 : s.hostCount >= 4,
} as const;

type Dimension = keyof typeof DIMENSIONS;

const DIMENSION_VALUES: Record<Dimension, readonly string[]> = {
  type: ["ad-set", "standalone", "exam-sim"],
  tier: TIER_ORDER,
  technique: [
    "web-to-shell",
    "service-exploitation",
    "linux-privesc",
    "windows-privesc",
    "local-privesc",
    "kerberoasting",
    "acl-abuse",
    "delegation",
    "lateral-movement",
    "domain-dominance",
    "trust-abuse",
  ],
  os: ["windows", "linux", "mixed"],
  status: ["not-started", "in-progress", "completed"],
  duration: ["under-2h", "2h-4h", "over-4h"],
  hosts: ["1", "2-3", "4-plus"],
};

function searchText(s: Scenario): string {
  return [s.name, s.domain, s.objective, s.summary, s.type, s.tier, ...s.techniques]
    .join(" ")
    .toLowerCase();
}

@Injectable()
export class CatalogueService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * The catalogue, filtered, sorted, faceted and paged.
   *
   * The published set is loaded and then filtered in process rather than in SQL. That is
   * a deliberate trade and it rests on one fact: the catalogue is curated content in the
   * dozens, while the thing that grows is the number of learners reading it. Doing it
   * here buys exact agreement with the filter panel, including facet counts taken with
   * every filter applied except the one being counted, which is awkward to express as
   * one query and easy to get subtly wrong as seven. If the catalogue ever reaches a
   * size where this matters, the filtering moves into SQL behind this same signature.
   */
  async list(
    orgId: string,
    userId: string,
    query: CatalogueQuery,
  ): Promise<CatalogueResponse> {
    const { scenarios, tier } = await withOrg(this.db, orgId, async (tx) => ({
      scenarios: await this.load(tx, userId),
      tier: await this.tierOf(tx, userId),
    }));

    const selected = this.selection(query);
    const terms = (query.q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);

    const matching = scenarios.filter((s) => this.matches(s, selected, terms));
    const sorted = this.sort(matching, query.sort, tier);

    const from = (query.page - 1) * query.perPage;
    return {
      scenarios: sorted.slice(from, from + query.perPage),
      total: sorted.length,
      page: query.page,
      perPage: query.perPage,
      facets: this.facets(scenarios, selected, terms),
    };
  }

  async detail(orgId: string, userId: string, slug: string): Promise<Scenario> {
    const found = await withOrg(this.db, orgId, (tx) => this.load(tx, userId, slug));
    const scenario = found[0];
    if (!scenario) throw new ApiException("not-found", "That scenario does not exist.");
    return scenario;
  }

  private selection(query: CatalogueQuery): Record<Dimension, string[]> {
    return {
      type: query.type ?? [],
      tier: query.tier ?? [],
      technique: query.technique ?? [],
      os: query.os ?? [],
      status: query.status ?? [],
      duration: query.duration ?? [],
      hosts: query.hosts ?? [],
    };
  }

  private matches(
    s: Scenario,
    selected: Record<Dimension, string[]>,
    terms: string[],
    except?: Dimension,
  ): boolean {
    for (const dimension of Object.keys(DIMENSIONS) as Dimension[]) {
      if (dimension === except) continue;
      const values = selected[dimension];
      // Within a dimension the ticks are an OR; across dimensions they are an AND. That
      // is what a filter panel means by ticking two tiers and one technique.
      if (values.length && !values.some((v) => DIMENSIONS[dimension](s, v))) return false;
    }
    if (terms.length) {
      const text = searchText(s);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  }

  private facets(
    all: Scenario[],
    selected: Record<Dimension, string[]>,
    terms: string[],
  ): CatalogueFacets {
    const out = {} as Record<Dimension, FacetCount[]>;
    for (const dimension of Object.keys(DIMENSIONS) as Dimension[]) {
      const pool = all.filter((s) => this.matches(s, selected, terms, dimension));
      out[dimension] = DIMENSION_VALUES[dimension].map((value) => ({
        value,
        count: pool.filter((s) => DIMENSIONS[dimension](s, value)).length,
      }));
    }
    return out;
  }

  private sort(list: Scenario[], sort: CatalogueQuery["sort"], tier: TierCode): Scenario[] {
    const index = (t: TierCode) => TIER_ORDER.indexOf(t);
    const byName = (a: Scenario, b: Scenario) => a.name.localeCompare(b.name);
    const sorted = [...list];
    switch (sort) {
      case "newest":
        return sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      case "difficulty":
        return sorted.sort(
          (a, b) => a.difficulty - b.difficulty || index(a.tier) - index(b.tier) || byName(a, b),
        );
      case "duration":
        return sorted.sort((a, b) => a.estMinutes - b.estMinutes || byName(a, b));
      default: {
        // Unfinished work first, then what sits at the learner's own tier, then outward
        // from it. Finished scenarios go last: they are still listed, but they are not
        // what the catalogue is for.
        const rank = (s: Scenario) => {
          if (s.recommended) return 0;
          if (s.status === "in-progress") return 1;
          if (s.status === "not-started") return s.tier === tier ? 2 : 3;
          return 4;
        };
        return sorted.sort(
          (a, b) =>
            rank(a) - rank(b) ||
            Math.abs(index(a.tier) - index(tier)) - Math.abs(index(b.tier) - index(tier)) ||
            index(a.tier) - index(b.tier) ||
            byName(a, b),
        );
      }
    }
  }

  private async tierOf(tx: Tx, userId: string): Promise<TierCode> {
    const rows = await tx.execute<{ tier: TierCode }>(sql`
      select tier from learner_tier where user_id = ${userId}
    `);
    return rows[0]?.tier ?? "C1";
  }

  /**
   * Loads scenarios with everything the detail page needs. The child tables are fetched
   * as three queries rather than one join, because joining hosts and links to a row that
   * already carries three aggregated arrays multiplies the result and then has to be
   * taken apart again.
   */
  private async load(tx: Tx, userId: string, slug?: string): Promise<Scenario[]> {
    const rows = await tx.execute<ScenarioRow>(sql`
      select s.id, s.slug, s.name, s.type, s.tier, s.objective, s.domain, s.os,
             s.est_minutes, s.host_count, s.difficulty, s.summary, s.published_at,
             coalesce(t.techniques, '{}') as techniques,
             coalesce(e.teaches, '{}') as teaches,
             coalesce(r.proof_requirements, '{}') as proof_requirements,
             coalesce(q.prerequisites, '[]'::json) as prerequisites,
             coalesce(p.status, 'not-started') as progress_status,
             p.attempts, p.best_minutes, p.proofs_captured, p.proofs_total,
             p.last_attempt_at, p.debrief_id
        from scenarios s
        left join lateral (
          select array_agg(technique) as techniques
            from scenario_techniques where scenario_id = s.id
        ) t on true
        left join lateral (
          select array_agg(text order by position) as teaches
            from scenario_teaches where scenario_id = s.id
        ) e on true
        left join lateral (
          select array_agg(text order by position) as proof_requirements
            from scenario_proof_requirements where scenario_id = s.id
        ) r on true
        left join lateral (
          select json_agg(json_build_object('label', label, 'kind', kind, 'ref', ref)
                          order by position) as prerequisites
            from scenario_prerequisites where scenario_id = s.id
        ) q on true
        left join scenario_progress p
          on p.scenario_id = s.id and p.user_id = ${userId}
       where s.status = 'published'
         and (${slug ?? null}::text is null or s.slug = ${slug ?? null}::text)
    `);
    if (rows.length === 0) return [];

    // Interpolating the array directly would expand to a record, "($1, $2, $3)", which
    // Postgres refuses to cast to uuid[]. Each id is bound as its own parameter instead.
    const ids = sql.join(
      rows.map((r) => sql`${r.id}::uuid`),
      sql`, `,
    );
    const hosts = await tx.execute<HostRow>(sql`
      select scenario_id, host_key, name, ip, os, role, exposure, ports, proofs
        from scenario_hosts
       where scenario_id in (${ids})
       order by position
    `);
    const links = await tx.execute<LinkRow>(sql`
      select scenario_id, from_key, to_key, label
        from scenario_links where scenario_id in (${ids})
    `);
    const credentials = await tx.execute<{
      scenario_id: string;
      username: string;
      password: string;
    }>(sql`
      select scenario_id, username, password
        from scenario_credentials where scenario_id in (${ids})
    `);

    const hostsBy = group(hosts, (h) => h.scenario_id);
    const linksBy = group(links, (l) => l.scenario_id);
    const credentialBy = new Map(credentials.map((c) => [c.scenario_id, c]));

    return rows.map((r) => {
      const credential = credentialBy.get(r.id);
      const history =
        r.attempts === null
          ? undefined
          : {
              attempts: r.attempts,
              ...(r.best_minutes !== null ? { bestMinutes: r.best_minutes } : {}),
              proofsCaptured: r.proofs_captured ?? 0,
              proofsTotal: r.proofs_total ?? 0,
              ...(r.last_attempt_at
                ? { lastAttempt: new Date(r.last_attempt_at).toISOString() }
                : {}),
              ...(r.debrief_id ? { debriefId: r.debrief_id } : {}),
            };
      return {
        id: r.slug,
        slug: r.slug,
        name: r.name,
        type: r.type,
        tier: r.tier,
        objective: r.objective,
        domain: r.domain,
        os: r.os,
        techniques: r.techniques,
        estMinutes: r.est_minutes,
        hostCount: r.host_count,
        status: r.progress_status,
        difficulty: r.difficulty,
        publishedAt: new Date(r.published_at).toISOString(),
        summary: r.summary,
        teaches: r.teaches,
        hosts: (hostsBy.get(r.id) ?? []).map((h) => ({
          id: h.host_key,
          name: h.name,
          ip: h.ip,
          os: h.os,
          role: h.role,
          exposure: h.exposure,
          ports: h.ports,
          ...(h.proofs && h.proofs.length ? { proofs: h.proofs } : {}),
        })),
        links: (linksBy.get(r.id) ?? []).map((l) => ({
          from: l.from_key,
          to: l.to_key,
          ...(l.label ? { label: l.label } : {}),
        })),
        ...(credential
          ? { credential: { username: credential.username, password: credential.password } }
          : {}),
        proofRequirements: r.proof_requirements,
        prerequisites: r.prerequisites,
        ...(history ? { history } : {}),
      };
    });
  }
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}
