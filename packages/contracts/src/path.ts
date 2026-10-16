import { z } from "zod";
import { isoDateTime, progressStatus, techniqueFamily, tierCode, type TechniqueFamily } from "./primitives";

/**
 * Where each tier sits relative to the learner. "passed" rather than "verified" for the
 * tiers below, because today a tier is declared, not earned, and the ladder should not
 * claim a check that never ran.
 */
export const ladderState = z.enum(["passed", "current", "next", "locked"]);
export type LadderState = z.infer<typeof ladderState>;

/**
 * "pending" means the criterion cannot be evaluated yet because the data it needs is not
 * recorded. It is never shown as met or unmet, and it blocks promotion like an unmet one.
 */
export const criterionState = z.enum(["met", "unmet", "pending"]);
export type CriterionState = z.infer<typeof criterionState>;

export const criterionScenario = z.object({
  slug: z.string(),
  name: z.string(),
  status: progressStatus,
});

export const criterion = z.object({
  id: z.string(),
  title: z.string(),
  state: criterionState,
  progress: z.object({ done: z.number().int().nonnegative(), of: z.number().int().positive() }).nullable(),
  /** What the evaluation found, in a sentence. Null when there is nothing to report. */
  evidence: z.string().nullable(),
  /** Why a pending criterion cannot be decided yet. Null unless state is pending. */
  pendingReason: z.string().nullable(),
  /** Scenarios that count towards this criterion, finished or not. */
  scenarios: z.array(criterionScenario),
});
export type Criterion = z.infer<typeof criterion>;

export const advancement = z.object({
  from: tierCode,
  to: tierCode,
  /** False when no rule has been decided for this step. The tier is then self-declared. */
  defined: z.boolean(),
  /** True only when every criterion is met. A pending criterion keeps this false. */
  eligible: z.boolean(),
  criteria: z.array(criterion),
});
export type Advancement = z.infer<typeof advancement>;

export const skillRow = z.object({
  technique: techniqueFamily,
  attempted: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  /** 0 to 1. Three completions count as full, the same number the C3 rule asks for. */
  strength: z.number().min(0).max(1),
  /** True once a captured proof demonstrates the technique. Arrives with lab sessions. */
  verified: z.boolean(),
  lastPractised: isoDateTime.nullable(),
});
export type SkillRow = z.infer<typeof skillRow>;

export const skillGroup = z.object({
  id: z.string(),
  label: z.string(),
  rows: z.array(skillRow),
});
export type SkillGroup = z.infer<typeof skillGroup>;

export const pathSummary = z.object({
  tier: tierCode,
  since: isoDateTime,
  ladder: z.array(z.object({ tier: tierCode, state: ladderState })),
  /** Null at the top tier, where there is nowhere further to go. */
  advancement: advancement.nullable(),
  skills: z.array(skillGroup),
});
export type PathSummary = z.infer<typeof pathSummary>;

export const declareTier = z.object({ tier: tierCode });
export type DeclareTier = z.infer<typeof declareTier>;

export const SKILL_GROUPS: { id: string; label: string; techniques: TechniqueFamily[] }[] = [
  { id: "foothold", label: "Initial access", techniques: ["web-to-shell", "service-exploitation"] },
  {
    id: "privesc",
    label: "Privilege escalation",
    techniques: ["linux-privesc", "windows-privesc", "local-privesc"],
  },
  {
    id: "ad",
    label: "Active Directory",
    techniques: [
      "kerberoasting",
      "acl-abuse",
      "lateral-movement",
      "delegation",
      "domain-dominance",
      "trust-abuse",
    ],
  },
];

/** Completions at which a technique reads as full strength. */
export const SKILL_FULL_AT = 3;
