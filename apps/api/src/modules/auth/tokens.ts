import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque tokens for sessions and emailed links.
 *
 * The raw token is shown once, to the holder. Only its SHA-256 is stored, so a database
 * copy does not let anyone sign in or complete a reset. Hashing is enough here, unlike
 * passwords, because the token is 256 bits of randomness rather than something a person
 * chose, and there is nothing to guess.
 */
export function issueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const RECOVERY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Recovery codes read back as two groups of five, matching what the UI prints. */
export function generateRecoveryCode(): string {
  const pick = () => {
    let out = "";
    for (const byte of randomBytes(5)) out += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
    return out;
  };
  return `${pick()}-${pick()}`;
}
