import { z } from "zod";

export const tierCode = z.enum(["C1", "C2", "C3", "C4"]);
export type TierCode = z.infer<typeof tierCode>;

/** Ascending. The order is the progression, and the catalogue sorts by distance along it. */
export const TIER_ORDER: readonly TierCode[] = ["C1", "C2", "C3", "C4"] as const;

export const TIER_NAMES: Record<TierCode, string> = {
  C1: "Apprentice",
  C2: "Practitioner",
  C3: "Adept",
  C4: "Master",
};

export const scenarioType = z.enum(["ad-set", "standalone", "exam-sim"]);
export type ScenarioType = z.infer<typeof scenarioType>;

export const techniqueFamily = z.enum([
  "local-privesc",
  "kerberoasting",
  "acl-abuse",
  "delegation",
  "lateral-movement",
  "domain-dominance",
  "trust-abuse",
  "web-to-shell",
  "service-exploitation",
  "linux-privesc",
  "windows-privesc",
]);
export type TechniqueFamily = z.infer<typeof techniqueFamily>;

export const osFamily = z.enum(["windows", "linux", "mixed"]);
export type OsFamily = z.infer<typeof osFamily>;

export const progressStatus = z.enum(["not-started", "in-progress", "completed"]);
export type ProgressStatus = z.infer<typeof progressStatus>;

export const hostExposure = z.enum(["learner-facing", "internal"]);
export type HostExposure = z.infer<typeof hostExposure>;

export const proofKind = z.enum(["local", "proof", "domain"]);
export type ProofKind = z.infer<typeof proofKind>;

export const connectionMethod = z.enum(["browser", "openvpn"]);
export type ConnectionMethod = z.infer<typeof connectionMethod>;

/** The help dial. The order is the escalation order and is relied on by the hint ladder. */
export const helpLevel = z.enum(["exam-sim", "shadow", "nudge", "coach", "teach", "walkthrough"]);
export type HelpLevel = z.infer<typeof helpLevel>;

export const onyxCommand = z.enum([
  "hint",
  "why",
  "check",
  "stuck",
  "explain",
  "methodology",
  "teach",
  "walkthrough",
  "review",
  "note",
]);
export type OnyxCommand = z.infer<typeof onyxCommand>;

export const sessionState = z.enum([
  "provisioning",
  "connecting",
  "running",
  "idle-warning",
  "expiring",
  "reconnecting",
  "ended",
  "failed",
]);
export type SessionState = z.infer<typeof sessionState>;

export const sessionOutcome = z.enum([
  "completed",
  "partial",
  "abandoned",
  "failed-provision",
  "expired",
]);
export type SessionOutcome = z.infer<typeof sessionOutcome>;

export const attackPhase = z.enum(["recon", "foothold", "privesc", "lateral", "domain"]);
export type AttackPhase = z.infer<typeof attackPhase>;

export const reportStatus = z.enum(["draft", "complete", "exported"]);
export type ReportStatus = z.infer<typeof reportStatus>;

export const evidenceKind = z.enum(["command", "note", "screenshot", "proof"]);
export type EvidenceKind = z.infer<typeof evidenceKind>;

export const invoiceStatus = z.enum(["paid", "open", "void", "uncollectible", "refunded"]);
export type InvoiceStatus = z.infer<typeof invoiceStatus>;

export const subscriptionStatus = z.enum([
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatus>;

export const accountStatus = z.enum(["trial", "active", "past-due", "lapsed"]);
export type AccountStatus = z.infer<typeof accountStatus>;

export const activityKind = z.enum([
  "lab-started",
  "lab-ended",
  "proof",
  "report",
  "tier",
  "debrief",
  "signup",
  "upgrade",
  "cancel",
  "payment-failed",
  "provision-failed",
  "launch",
  "alert",
]);
export type ActivityKind = z.infer<typeof activityKind>;

export const tone = z.enum([
  "neutral",
  "primary",
  "success",
  "info",
  "med",
  "high",
  "crit",
  "premium",
]);
export type Tone = z.infer<typeof tone>;

/** Roles a membership can hold. Operator roles gate the portal; learner is the default. */
export const memberRole = z.enum([
  "learner",
  "owner",
  "finance",
  "infra",
  "content",
  "onyx-reviewer",
  "support",
]);
export type MemberRole = z.infer<typeof memberRole>;

export const isoDateTime = z.string().datetime({ offset: true });

/** Opaque public identifiers. Prefixes match the ids the frontend already renders. */
export const userId = z.string().regex(/^usr_[A-Za-z0-9]{6,}$/);
export const sessionId = z.string().regex(/^ses_[A-Za-z0-9]{6,}$/);
export const tenantId = z.string().regex(/^rp-t-[a-z0-9]{6,}$/);
export const orgId = z.string().uuid();
