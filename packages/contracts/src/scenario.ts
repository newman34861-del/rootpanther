import { z } from "zod";
import {
  attackPhase,
  hostExposure,
  isoDateTime,
  osFamily,
  progressStatus,
  proofKind,
  scenarioType,
  techniqueFamily,
  tierCode,
} from "./primitives";

export const host = z.object({
  id: z.string(),
  name: z.string(),
  ip: z.string(),
  os: z.enum(["windows", "linux"]),
  role: z.string(),
  exposure: hostExposure,
  owned: z.boolean().optional(),
  reachable: z.boolean().optional(),
  ports: z.array(z.number().int()).optional(),
  proofs: z.array(proofKind).optional(),
});
export type Host = z.infer<typeof host>;

export const topologyLink = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});
export type TopologyLink = z.infer<typeof topologyLink>;

export const scenarioHistory = z.object({
  attempts: z.number().int().nonnegative(),
  bestMinutes: z.number().int().positive().optional(),
  proofsCaptured: z.number().int().nonnegative(),
  proofsTotal: z.number().int().nonnegative(),
  lastAttempt: isoDateTime.optional(),
  debriefId: z.string().optional(),
});
export type ScenarioHistory = z.infer<typeof scenarioHistory>;

export const prerequisite = z.object({
  label: z.string(),
  kind: z.enum(["scenario", "primer"]),
  ref: z.string(),
});
export type Prerequisite = z.infer<typeof prerequisite>;

export const scenario = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: scenarioType,
  tier: tierCode,
  objective: z.string(),
  domain: z.string(),
  os: osFamily,
  techniques: z.array(techniqueFamily),
  estMinutes: z.number().int().positive(),
  hostCount: z.number().int().positive(),
  status: progressStatus,
  difficulty: z.number().int().min(1).max(5),
  publishedAt: isoDateTime,
  summary: z.string(),
  teaches: z.array(z.string()),
  hosts: z.array(host),
  links: z.array(topologyLink),
  credential: z.object({ username: z.string(), password: z.string() }).optional(),
  proofRequirements: z.array(z.string()),
  prerequisites: z.array(prerequisite),
  history: scenarioHistory.optional(),
  recommended: z.boolean().optional(),
});
export type Scenario = z.infer<typeof scenario>;

/**
 * Grounding is authored per scenario per phase. A scenario without it cannot be tutored,
 * which is why publishing is gated on completeness rather than on the author remembering.
 */
export const groundingCell = z.object({
  phase: attackPhase,
  applicable: z.boolean(),
  opener: z.string().nullable(),
  hints: z.array(z.string()).max(4),
});
export type GroundingCell = z.infer<typeof groundingCell>;

/** Buckets rather than a range, because that is what the filter panel offers. */
export const durationBucket = z.enum(["under-2h", "2h-4h", "over-4h"]);
export type DurationBucket = z.infer<typeof durationBucket>;

export const hostBucket = z.enum(["1", "2-3", "4-plus"]);
export type HostBucket = z.infer<typeof hostBucket>;

export const catalogueSort = z.enum(["recommended", "newest", "difficulty", "duration"]);
export type CatalogueSort = z.infer<typeof catalogueSort>;

export const catalogueQuery = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.array(scenarioType).optional(),
  tier: z.array(tierCode).optional(),
  technique: z.array(techniqueFamily).optional(),
  os: z.array(osFamily).optional(),
  status: z.array(progressStatus).optional(),
  duration: z.array(durationBucket).optional(),
  hosts: z.array(hostBucket).optional(),
  sort: catalogueSort.default("recommended"),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(50),
});
export type CatalogueQuery = z.infer<typeof catalogueQuery>;

export const facetCount = z.object({ value: z.string(), count: z.number().int().nonnegative() });
export type FacetCount = z.infer<typeof facetCount>;

/**
 * Counts are taken with every filter applied except the one being counted. A tier count
 * that already had the tier filter applied would read zero for every tier the learner
 * has not ticked, which makes the panel useless for discovering what else is there.
 */
export const catalogueFacets = z.object({
  type: z.array(facetCount),
  tier: z.array(facetCount),
  technique: z.array(facetCount),
  os: z.array(facetCount),
  status: z.array(facetCount),
  duration: z.array(facetCount),
  hosts: z.array(facetCount),
});
export type CatalogueFacets = z.infer<typeof catalogueFacets>;

export const catalogueResponse = z.object({
  scenarios: z.array(scenario),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  facets: catalogueFacets,
});
export type CatalogueResponse = z.infer<typeof catalogueResponse>;
