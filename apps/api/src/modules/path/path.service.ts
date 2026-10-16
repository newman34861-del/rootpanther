import { Inject, Injectable } from "@nestjs/common";
import {
  SKILL_FULL_AT,
  SKILL_GROUPS,
  TIER_ORDER,
  type Advancement,
  type Criterion,
  type PathSummary,
  type SkillGroup,
  type TechniqueFamily,
  type TierCode,
} from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { ApiException } from "../../common/errors";
import type { Database, Tx } from "../../db/client";
import { DB } from "../../db/db.module";
import { withOrg } from "../../db/tenancy";

type ProgressRow = {
  slug: string;
  name: string;
  tier: TierCode;
  status: "not-started" | "in-progress" | "completed";
  attempts: number;
  last_attempt_at: Date | null;
  techniques: TechniqueFamily[];
};

type ScenarioRef = { slug: string; name: string };

/** The C2 to C3 rule. Decided by Abe on 2026-10-16. */
const C3_SCENARIOS_REQUIRED = 3;

@Injectable()
export class PathService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async summary(orgId: string, userId: string): Promise<PathSummary> {
    return withOrg(this.db, orgId, async (tx) => {
      const { tier, since } = await this.tierOf(tx, userId);
      const progress = await this.progress(tx, userId);
      const current = TIER_ORDER.indexOf(tier);

      return {
        tier,
        since,
        ladder: TIER_ORDER.map((t, i) => ({
          tier: t,
          state: i < current ? "passed" : i === current ? "current" : i === current + 1 ? "next" : "locked",
        })),
        advancement:
          current === TIER_ORDER.length - 1
            ? null
            : await this.advancement(tx, tier, TIER_ORDER[current + 1], progress),
        skills: this.skills(progress),
      };
    });
  }

  /**
   * Sets the learner's tier. Self-declared today, so any tier is accepted; when earned
   * progression lands, this becomes the path for moving down or for an operator override,
   * and moving up goes through the criteria instead.
   */
  async declare(orgId: string, userId: string, tier: TierCode): Promise<PathSummary> {
    await withOrg(this.db, orgId, async (tx) => {
      await tx.execute(sql`
        insert into learner_tier (org_id, user_id, tier, since)
        values (${orgId}, ${userId}, ${tier}, now())
        on conflict (org_id, user_id) do update
          set tier = excluded.tier,
              since = case when learner_tier.tier = excluded.tier
                           then learner_tier.since else now() end
      `);
    });
    return this.summary(orgId, userId);
  }

  private async tierOf(tx: Tx, userId: string): Promise<{ tier: TierCode; since: string }> {
    const rows = await tx.execute<{ tier: TierCode; since: Date }>(sql`
      select tier, since from learner_tier where user_id = ${userId}
    `);
    if (rows[0]) return { tier: rows[0].tier, since: new Date(rows[0].since).toISOString() };

    // No row means C1 since the account was opened. That is a fact about the account,
    // not a decision anybody made, which is why nothing is written here.
    const users = await tx.execute<{ created_at: Date }>(sql`
      select created_at from users where id = ${userId}
    `);
    if (!users[0]) throw new ApiException("not-found", "That account no longer exists.");
    return { tier: "C1", since: new Date(users[0].created_at).toISOString() };
  }

  private async progress(tx: Tx, userId: string): Promise<ProgressRow[]> {
    return tx.execute<ProgressRow>(sql`
      select s.slug, s.name, s.tier, p.status, p.attempts, p.last_attempt_at,
             coalesce((select array_agg(technique) from scenario_techniques t
                        where t.scenario_id = s.id), '{}') as techniques
        from scenario_progress p
        join scenarios s on s.id = p.scenario_id
       where p.user_id = ${userId}
    `);
  }

  private async publishedAt(tx: Tx, tier: TierCode): Promise<ScenarioRef[]> {
    return tx.execute<ScenarioRef>(sql`
      select slug, name from scenarios
       where status = 'published' and tier = ${tier}
       order by name
    `);
  }

  private async advancement(
    tx: Tx,
    from: TierCode,
    to: TierCode,
    progress: ProgressRow[],
  ): Promise<Advancement> {
    if (from !== "C2") {
      // No rule has been decided for this step. Saying so is better than inventing one:
      // a criterion the product never agreed to would be a promise nobody made.
      return { from, to, defined: false, eligible: false, criteria: [] };
    }

    const pool = await this.publishedAt(tx, "C2");
    const statusOf = new Map(progress.map((p) => [p.slug, p.status]));
    const scenarios = pool.map((s) => ({ ...s, status: statusOf.get(s.slug) ?? "not-started" }));
    const finished = scenarios.filter((s) => s.status === "completed");
    const done = Math.min(finished.length, C3_SCENARIOS_REQUIRED);

    const criteria: Criterion[] = [
      {
        id: "c2-finishes",
        title: `Finish ${C3_SCENARIOS_REQUIRED} C2 scenarios`,
        state: finished.length >= C3_SCENARIOS_REQUIRED ? "met" : "unmet",
        progress: { done, of: C3_SCENARIOS_REQUIRED },
        evidence: finished.length ? `Finished ${finished.map((s) => s.name).join(", ")}` : null,
        pendingReason: null,
        scenarios,
      },
      {
        id: "c2-solo",
        title: "Without Teach or Walkthrough help",
        state: "pending",
        progress: null,
        evidence: null,
        pendingReason: "Onyx does not record the help level used per session yet.",
        scenarios: [],
      },
      {
        id: "c2-report",
        title: "Submit one report that passes review",
        state: "pending",
        progress: null,
        evidence: null,
        pendingReason: "Reports are not recorded yet.",
        scenarios: [],
      },
    ];

    return {
      from,
      to,
      defined: true,
      eligible: criteria.every((c) => c.state === "met"),
      criteria,
    };
  }

  private skills(progress: ProgressRow[]): SkillGroup[] {
    return SKILL_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      rows: group.techniques.map((technique) => {
        const touched = progress.filter((p) => p.techniques.includes(technique));
        const attempted = touched.filter((p) => p.attempts > 0 || p.status !== "not-started");
        const completed = touched.filter((p) => p.status === "completed");
        const last = attempted
          .map((p) => p.last_attempt_at)
          .filter((d): d is Date => d !== null)
          .map((d) => new Date(d).getTime())
          .sort((a, b) => b - a)[0];
        return {
          technique,
          attempted: attempted.length,
          completed: completed.length,
          strength: Math.min(completed.length, SKILL_FULL_AT) / SKILL_FULL_AT,
          verified: false,
          lastPractised: last ? new Date(last).toISOString() : null,
        };
      }),
    }));
  }
}
