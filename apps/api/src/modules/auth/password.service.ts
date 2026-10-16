import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { AUTH_POLICY, type PasswordStrength } from "@rootpanther/contracts";
import argon2 from "argon2";

/**
 * Passwords seen often enough in breach corpora that they are guessed before any
 * brute force begins. The list is deliberately short: it blocks the worst choices
 * without pretending to be a breach database. A k-anonymity lookup against a breach
 * service is the next step and slots in behind isCommon.
 */
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "letmein",
  "welcome",
  "welcome1",
  "admin",
  "admin123",
  "iloveyou",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "abc123",
  "changeme",
  "passw0rd",
  "trustno1",
  "hunter2",
  "rootpanther",
  "kalilinux",
  "oscp2026",
  "offsecoscp",
  "correcthorsebatterystaple",
]);

@Injectable()
export class PasswordService {
  /**
   * argon2id with parameters above the OWASP floor. Memory cost dominates the defence,
   * so it is raised rather than the iteration count.
   */
  private readonly options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * A real hash of a value nobody holds, computed once. Verifying an unknown account
   * against it makes the failed path cost the same as the successful one, so response
   * time cannot be used to discover which addresses are registered. A fabricated string
   * would not work: argon2 rejects a malformed hash immediately.
   */
  private dummy: Promise<string> | null = null;
  dummyHash(): Promise<string> {
    this.dummy ??= argon2.hash(randomBytes(32).toString("hex"), this.options);
    return this.dummy;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed stored hash must read as a failed login, never as an error that
      // tells the caller something about the account.
      return false;
    }
  }

  /** Mirrors the rules the sign-up form shows, so the verdict never disagrees. */
  strength(plain: string, personal: string[] = []): PasswordStrength {
    const lower = plain.toLowerCase();
    const rules = {
      length: plain.length >= AUTH_POLICY.passwordMinLength,
      case: /[a-z]/.test(plain) && /[A-Z]/.test(plain),
      number: /\d/.test(plain),
      common: !this.isCommon(lower, personal),
    };
    const score = Object.values(rules).filter(Boolean).length;
    return { score, rules };
  }

  acceptable(plain: string, personal: string[] = []): boolean {
    const { rules } = this.strength(plain, personal);
    return rules.length && rules.common;
  }

  private isCommon(lower: string, personal: string[]): boolean {
    // Compared against the root as well as the whole string. Appending digits to a
    // password everyone already guesses is the most common way of meeting a length rule,
    // and an exact-match list lets "password1234" through while refusing "password123".
    const root = lower.replace(/[^a-z0-9]/g, "").replace(/\d+$/, "");
    if (COMMON.has(lower) || COMMON.has(root)) return true;
    // A password built from the learner's own email or name is guessable by anyone
    // holding the signup record.
    return personal.some((token) => token.length >= 4 && lower.includes(token.toLowerCase()));
  }
}
