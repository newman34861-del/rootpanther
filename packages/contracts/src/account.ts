import { z } from "zod";
import {
  activityKind,
  connectionMethod,
  helpLevel,
  isoDateTime,
  memberRole,
  tierCode,
  tone,
} from "./primitives";

export const currentUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  handle: z.string().optional(),
  initials: z.string(),
  tier: tierCode,
  tierSince: isoDateTime,
  roles: z.array(memberRole),
  plan: z.string(),
  helpDefault: helpLevel,
  connectionDefault: connectionMethod,
});
export type CurrentUser = z.infer<typeof currentUser>;

export const activityItem = z.object({
  id: z.string(),
  kind: activityKind,
  title: z.string(),
  detail: z.string().optional(),
  at: isoDateTime,
  tone: tone.optional(),
  href: z.string().optional(),
});
export type ActivityItem = z.infer<typeof activityItem>;

export const notification = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().optional(),
  at: isoDateTime,
  read: z.boolean(),
  tone: tone.optional(),
  href: z.string().optional(),
});
export type Notification = z.infer<typeof notification>;

export const profile = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  /** Set while a change of address is waiting on the confirmation link. */
  pendingEmail: z.string().email().nullable(),
  country: z.string().nullable(),
  handle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  initials: z.string(),
  memberSince: isoDateTime,
  deletionScheduledFor: isoDateTime.nullable(),
});
export type Profile = z.infer<typeof profile>;

/**
 * Why a handle was refused, so the form can say which rule was broken rather than only
 * that something was wrong.
 */
export const handleAvailability = z.object({
  handle: z.string(),
  available: z.boolean(),
  reason: z.enum(["taken", "reserved", "malformed", "unchanged"]).nullable(),
});
export type HandleAvailability = z.infer<typeof handleAvailability>;

/** What deleting the account would take with it, shown before the learner confirms. */
export const accountFootprint = z.object({
  labSessions: z.number().int().nonnegative(),
  proofs: z.number().int().nonnegative(),
  reports: z.number().int().nonnegative(),
  debriefs: z.number().int().nonnegative(),
  onyxConversations: z.number().int().nonnegative(),
});
export type AccountFootprint = z.infer<typeof accountFootprint>;

export const profileUpdate = z.object({
  name: z.string().trim().min(2).max(80),
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,30}$/)
    .optional(),
  country: z.string().length(2).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdate>;

export const terminalTheme = z.enum(["deep-space", "high-contrast", "paper"]);

export const preferencesUpdate = z.object({
  helpDefault: helpLevel,
  terminalFontSize: z.number().int().min(10).max(22),
  terminalTheme,
  email: z.object({
    sessionExpiry: z.boolean(),
    debriefReady: z.boolean(),
    newScenarios: z.boolean(),
    billing: z.boolean(),
  }),
});
export type PreferencesUpdate = z.infer<typeof preferencesUpdate>;
/** A read returns exactly what a write accepts, so the settings form round-trips. */
export const preferences = preferencesUpdate;
export type Preferences = PreferencesUpdate;

export const teardownPolicy = z.enum(["idle", "leave", "max-life"]);

export const labDefaultsUpdate = z.object({
  connection: connectionMethod,
  teardown: teardownPolicy,
  sshKey: z.string().nullable(),
});
export type LabDefaultsUpdate = z.infer<typeof labDefaultsUpdate>;
export const labDefaults = labDefaultsUpdate;
export type LabDefaults = LabDefaultsUpdate;

export const PREFERENCE_DEFAULTS: Preferences = {
  helpDefault: "nudge",
  terminalFontSize: 14,
  terminalTheme: "deep-space",
  email: { sessionExpiry: true, debriefReady: true, newScenarios: false, billing: true },
};

export const LAB_DEFAULTS: LabDefaults = {
  connection: "openvpn",
  teardown: "idle",
  sshKey: null,
};

/**
 * Handles that are never issued, because they would let one learner be mistaken for the
 * platform. Shared with the sign-up form so the refusal is shown before submitting, but
 * the server is the one that decides.
 */
export const RESERVED_HANDLES = [
  "admin",
  "administrator",
  "api",
  "billing",
  "help",
  "onyx",
  "operator",
  "root",
  "rootpanther",
  "security",
  "staff",
  "support",
  "system",
  "www",
] as const;
