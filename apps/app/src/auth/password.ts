import { BREACHED_PASSWORDS } from "../mock/settings";

export type PasswordRuleId = "length" | "case" | "number" | "common";

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  met: boolean;
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordCheck {
  rules: PasswordRule[];
  score: StrengthScore;
  label: string;
  valid: boolean;
}

const COMMON_FRAGMENTS = /(password|passw0rd|qwerty|letmein|welcome|rootpanther|123456|abcdef)/i;

function isCommon(pw: string, personal: string[]): boolean {
  const lower = pw.toLowerCase();
  if (BREACHED_PASSWORDS.includes(lower)) return true;
  if (COMMON_FRAGMENTS.test(pw)) return true;
  if (/^(.)\1+$/.test(pw)) return true;
  return personal.some((p) => p.length >= 4 && lower.includes(p.toLowerCase()));
}

export function personalTokens(...values: (string | undefined)[]): string[] {
  return values.flatMap((v) => (v ?? "").split(/[^A-Za-z0-9]+/)).filter((t) => t.length >= 4);
}

const LABELS = ["", "Weak", "Fair", "Good", "Strong"];

export function checkPassword(pw: string, personal: string[] = []): PasswordCheck {
  const common = pw.length > 0 && isCommon(pw, personal);
  const rules: PasswordRule[] = [
    { id: "length", label: "12 or more characters", met: pw.length >= 12 },
    { id: "case", label: "Upper and lower case letters", met: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: "number", label: "At least one number", met: /\d/.test(pw) },
    { id: "common", label: "Not a common or breached password", met: pw.length > 0 && !common },
  ];
  const basics = rules.filter((r) => r.id !== "common" && r.met).length;
  let score: StrengthScore = 0;
  if (pw.length > 0) {
    if (common || pw.length < 8) score = 1;
    else if (basics === 3) score = pw.length >= 16 || /[^A-Za-z0-9]/.test(pw) ? 4 : 3;
    else score = basics >= 2 ? 2 : 1;
  }
  return { rules, score, label: LABELS[score], valid: rules.every((r) => r.met) };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your email address";
  if (!EMAIL_RE.test(v)) return "Enter an email address in the format name@example.com";
  return null;
}
