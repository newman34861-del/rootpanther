import { z } from "zod";
import { isoDateTime } from "./primitives";

/**
 * Policy the server enforces. The sign-up form mirrors these rules so the learner sees
 * the same verdict before submitting, but the server is the one that decides.
 */
export const AUTH_POLICY = {
  passwordMinLength: 10,
  passwordMaxLength: 200,
  /** Learner lockout. The portal is stricter and is configured separately. */
  attemptsBeforeLock: 5,
  lockMinutes: 15,
  totpAttempts: 5,
  resendCooldownSeconds: 30,
  resetLinkMinutes: 30,
  verifyLinkHours: 24,
  recoveryCodeCount: 10,
  sessionDays: 30,
} as const;

export const oauthProvider = z.enum(["google", "microsoft", "github"]);
export type OauthProvider = z.infer<typeof oauthProvider>;

export const password = z
  .string()
  .min(AUTH_POLICY.passwordMinLength)
  .max(AUTH_POLICY.passwordMaxLength);

export const signUpRequest = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password,
});
export type SignUpRequest = z.infer<typeof signUpRequest>;

export const signInRequest = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(AUTH_POLICY.passwordMaxLength),
});
export type SignInRequest = z.infer<typeof signInRequest>;

/**
 * Sign-in either completes or stops at the second factor. The pending state carries no
 * user detail, so a stolen first factor reveals nothing about the account.
 */
export const signInResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("authenticated") }),
  z.object({ status: z.literal("totp-required") }),
  z.object({ status: z.literal("locked"), until: isoDateTime }),
]);
export type SignInResult = z.infer<typeof signInResult>;

export const totpCode = z.object({ code: z.string().regex(/^\d{6}$/) });
export type TotpCode = z.infer<typeof totpCode>;

export const recoveryCode = z.object({ code: z.string().regex(/^[a-z0-9]{5}-[a-z0-9]{5}$/) });
export type RecoveryCode = z.infer<typeof recoveryCode>;

export const emailOnly = z.object({ email: z.string().trim().toLowerCase().email() });
export type EmailOnly = z.infer<typeof emailOnly>;

export const resetConfirm = z.object({ token: z.string().min(16), password });
export type ResetConfirm = z.infer<typeof resetConfirm>;

export const changePassword = z.object({
  currentPassword: z.string().max(AUTH_POLICY.passwordMaxLength).optional(),
  newPassword: password,
});
export type ChangePassword = z.infer<typeof changePassword>;

export const totpSetup = z.object({
  secret: z.string(),
  otpauth: z.string(),
});
export type TotpSetup = z.infer<typeof totpSetup>;

export const deviceSession = z.object({
  id: z.string(),
  device: z.string().nullable(),
  kind: z.enum(["desktop", "laptop", "mobile", "tablet", "unknown"]),
  location: z.string().nullable(),
  ip: z.string().nullable(),
  lastActive: isoDateTime,
  current: z.boolean(),
});
export type DeviceSession = z.infer<typeof deviceSession>;

export const connectedAccount = z.object({
  provider: oauthProvider,
  linked: z.boolean(),
  account: z.string().nullable(),
  linkedAt: isoDateTime.nullable(),
});
export type ConnectedAccount = z.infer<typeof connectedAccount>;

export const securityState = z.object({
  hasPassword: z.boolean(),
  passwordChangedAt: isoDateTime.nullable(),
  twoFactor: z.object({
    enabled: z.boolean(),
    enabledAt: isoDateTime.nullable(),
    codesLeft: z.number().int().nonnegative(),
  }),
  sessions: z.array(deviceSession),
  accounts: z.array(connectedAccount),
});
export type SecurityState = z.infer<typeof securityState>;

export const passwordStrength = z.object({
  score: z.number().int().min(0).max(4),
  rules: z.object({
    length: z.boolean(),
    case: z.boolean(),
    number: z.boolean(),
    common: z.boolean(),
  }),
});
export type PasswordStrength = z.infer<typeof passwordStrength>;
