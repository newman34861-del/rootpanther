import { z } from "zod";
import {
  connectionMethod,
  helpLevel,
  isoDateTime,
  proofKind,
  sessionOutcome,
  sessionState,
} from "./primitives";
import { host } from "./scenario";

/**
 * Lifecycle limits the backend enforces. The frontend displays them but never decides
 * them. Exam simulations run long because the exam does.
 */
export const LAB_LIMITS = {
  idleShutdownMin: 30,
  idleWarnMin: 25,
  maxLifeMin: 240,
  examSimMaxLifeMin: 1440,
  extendOptionsMin: [30, 60],
  maxTotalMin: 480,
  leaveGraceMin: 5,
  expiryWarningMin: 2,
} as const;

/** Fair use. Going past the allowance costs nothing and never stops a running session. */
export const USAGE_LIMITS = {
  fairUseHoursPerMonth: 60,
  maxConcurrentLabs: 1,
} as const;

export const labSession = z.object({
  id: z.string(),
  scenarioId: z.string(),
  scenarioName: z.string(),
  domain: z.string(),
  objective: z.string(),
  startedAt: isoDateTime,
  elapsedMin: z.number().int().nonnegative(),
  maxLifeMin: z.number().int().positive(),
  idleMin: z.number().int().nonnegative(),
  idleLimitMin: z.number().int().positive(),
  hosts: z.array(host),
  connection: connectionMethod,
  state: sessionState,
  helpLevel,
});
export type LabSession = z.infer<typeof labSession>;

export const sessionRecord = z.object({
  id: z.string(),
  scenarioId: z.string(),
  scenarioName: z.string(),
  startedAt: isoDateTime,
  durationMin: z.number().int().nonnegative(),
  hostsOwned: z.number().int().nonnegative(),
  hostsTotal: z.number().int().nonnegative(),
  outcome: sessionOutcome,
  chargedHours: z.number().nonnegative(),
  debriefId: z.string().optional(),
  reportId: z.string().optional(),
});
export type SessionRecord = z.infer<typeof sessionRecord>;

export const usageSummary = z.object({
  usedHours: z.number().nonnegative(),
  allowanceHours: z.number().positive(),
  resetsOn: isoDateTime,
  periodStart: isoDateTime,
});
export type UsageSummary = z.infer<typeof usageSummary>;

export const launchRequest = z.object({
  scenarioId: z.string(),
  connection: connectionMethod,
  helpLevel,
});
export type LaunchRequest = z.infer<typeof launchRequest>;

/**
 * A launch is admitted or queued. Queueing is the product behaviour when the fair-use
 * allowance is spent or the region has no vCPU headroom, never an error.
 */
export const launchResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("admitted"), sessionId: z.string() }),
  z.object({
    status: z.literal("queued"),
    sessionId: z.string(),
    position: z.number().int().positive(),
    reason: z.enum(["capacity", "allowance"]),
  }),
]);
export type LaunchResponse = z.infer<typeof launchResponse>;

export const extendRequest = z.object({
  addMinutes: z.union([z.literal(30), z.literal(60)]),
});
export type ExtendRequest = z.infer<typeof extendRequest>;

export const provisionStep = z.object({
  index: z.number().int().positive(),
  of: z.number().int().positive(),
  label: z.string(),
  state: z.enum(["pending", "running", "done", "failed"]),
  at: isoDateTime.optional(),
});
export type ProvisionStep = z.infer<typeof provisionStep>;

export const proofCapture = z.object({
  hostId: z.string(),
  kind: proofKind,
  token: z.string().min(8),
});
export type ProofCapture = z.infer<typeof proofCapture>;

export const vpnProfile = z.object({
  fileName: z.string(),
  endpoint: z.string(),
  tunnelAddress: z.string(),
  issuedAt: isoDateTime,
  config: z.string(),
});
export type VpnProfile = z.infer<typeof vpnProfile>;

export const connectionTest = z.enum(["untested", "testing", "connected", "failed"]);
export type ConnectionTest = z.infer<typeof connectionTest>;
