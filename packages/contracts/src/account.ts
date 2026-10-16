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

export const teardownPolicy = z.enum(["idle", "leave", "max-life"]);

export const labDefaultsUpdate = z.object({
  connection: connectionMethod,
  teardown: teardownPolicy,
  sshKey: z.string().nullable(),
});
export type LabDefaultsUpdate = z.infer<typeof labDefaultsUpdate>;
