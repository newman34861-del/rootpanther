import { randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AUTH_POLICY, type SignInResult } from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { ApiException } from "../../common/errors";
import { DB } from "../../db/db.module";
import type { Database } from "../../db/client";
import { withOrg } from "../../db/tenancy";
import { EmailService } from "../email/email.service";
import { LockoutService } from "./lockout.service";
import { PasswordService } from "./password.service";
import { SessionService, type RequestMeta } from "./session.service";
import { TotpService } from "./totp.service";
import { hashToken, issueToken } from "./tokens";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function publicId(prefix: string, length = 8): string {
  let out = "";
  for (const byte of randomBytes(length)) out += ID_ALPHABET[byte % ID_ALPHABET.length];
  return `${prefix}_${out}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// A type alias rather than an interface: drizzle's execute generic requires the row to
// satisfy Record<string, unknown>, which an interface does not provide implicitly.
type UserRow = {
  id: string;
  email: string;
  name: string;
  email_verified_at: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly lockout: LockoutService,
    private readonly totp: TotpService,
    private readonly email: EmailService,
  ) {}

  /**
   * Creates the learner and the personal organisation that owns their data in one
   * transaction. An account without an organisation would have nowhere to put a lab
   * session, so the two are never separate.
   */
  async signUp(input: { name: string; email: string; password: string }, meta: RequestMeta) {
    if (!this.passwords.acceptable(input.password, [input.email.split("@")[0], input.name])) {
      throw new ApiException("validation", "Choose a longer, less common password.", {
        password: "Too easy to guess.",
      });
    }

    const existing = await this.db.execute<{ id: string }>(
      sql`select id from users where email = ${input.email}`,
    );
    if (existing[0]) {
      // Reported as a conflict rather than silently succeeding, because the sign-up form
      // needs to offer sign-in instead. The sign-in path is where enumeration matters.
      throw new ApiException("conflict", "That email already has an account.");
    }

    const passwordHash = await this.passwords.hash(input.password);

    // The organisation id is chosen here so the transaction can be scoped to it before
    // anything is written. Account creation then obeys the same isolation rule as every
    // other write: it can only insert into the organisation it is scoped to, and cannot
    // reach an existing one.
    const orgId = randomUUID();
    const userId = await withOrg(this.db, orgId, async (tx) => {
      await tx.execute(sql`
        insert into organizations (id, public_id, name, personal)
        values (${orgId}, ${publicId("org")}, ${input.name}, true)
      `);
      const users = await tx.execute<{ id: string }>(sql`
        insert into users (public_id, email, name)
        values (${publicId("usr")}, ${input.email}, ${input.name})
        returning id
      `);
      const id = users[0].id;
      await tx.execute(sql`
        insert into memberships (org_id, user_id, role) values (${orgId}, ${id}, 'learner')
      `);
      await tx.execute(sql`
        insert into credentials (user_id, password_hash) values (${id}, ${passwordHash})
      `);
      return id;
    });

    await this.sendEmailToken(userId, input.email, "verify_email", AUTH_POLICY.verifyLinkHours * 60);
    return this.sessions.issue(userId, meta);
  }

  async signIn(
    input: { email: string; password: string },
    meta: RequestMeta,
  ): Promise<{ result: SignInResult; token?: string; pending?: string; expiresAt?: Date }> {
    const lock = await this.lockout.state(input.email);
    if (lock.locked && lock.until) {
      return { result: { status: "locked", until: lock.until.toISOString() } };
    }

    const rows = await this.db.execute<UserRow & { password_hash: string | null }>(sql`
      select u.id, u.email, u.name, u.email_verified_at, c.password_hash
        from users u left join credentials c on c.user_id = u.id
       where u.email = ${input.email}
    `);
    const user = rows[0];

    // Verify against a throwaway hash when the account is unknown so both paths cost the
    // same, and a timing difference cannot be used to discover who has an account.
    const hash = user?.password_hash ?? (await this.passwords.dummyHash());
    const ok = await this.passwords.verify(hash, input.password);

    if (!user || !user.password_hash || !ok) {
      const after = await this.lockout.recordFailure(input.email);
      if (after.locked && after.until) {
        return { result: { status: "locked", until: after.until.toISOString() } };
      }
      throw new ApiException("unauthenticated", "That email and password do not match.");
    }

    await this.lockout.clear(input.email);

    const totp = await this.totp.status(user.id);
    if (totp.enabled) {
      const pending = await this.issuePendingToken(user.id, user.email);
      return { result: { status: "totp-required" }, pending };
    }

    const issued = await this.sessions.issue(user.id, meta);
    return { result: { status: "authenticated" }, token: issued.token, expiresAt: issued.expiresAt };
  }

  /** Completes a sign-in that stopped at the second factor. */
  async completeTotp(pendingToken: string, code: string, meta: RequestMeta, isRecovery: boolean) {
    const rows = await this.db.execute<{ id: string; user_id: string; email: string }>(sql`
      select id, user_id, email from email_tokens
       where token_hash = ${hashToken(pendingToken)}
         and purpose = 'totp_pending'
         and consumed_at is null
         and expires_at > now()
    `);
    const pending = rows[0];
    if (!pending) throw new ApiException("unauthenticated", "That sign-in attempt expired.");

    const accepted = isRecovery
      ? await this.totp.consumeRecoveryCode(pending.user_id, code)
      : await this.totp.verify(pending.user_id, pending.email, code);

    if (!accepted) {
      const after = await this.lockout.recordFailure(pending.email);
      if (after.locked) throw new ApiException("unauthenticated", "Too many attempts.");
      throw new ApiException("unauthenticated", "That code is not valid.");
    }

    await this.db.execute(sql`
      update email_tokens set consumed_at = now() where id = ${pending.id}
    `);
    await this.lockout.clear(pending.email);
    return this.sessions.issue(pending.user_id, meta);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const rows = await this.db.execute<{ id: string }>(
      sql`select id from users where email = ${email}`,
    );
    // Always reports success to the caller. Only a real account produces a message, so
    // the response cannot be used to test which addresses are registered.
    if (!rows[0]) return;
    await this.sendEmailToken(rows[0].id, email, "password_reset", AUTH_POLICY.resetLinkMinutes);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const rows = await this.db.execute<{ id: string; user_id: string; email: string }>(sql`
      select id, user_id, email from email_tokens
       where token_hash = ${hashToken(token)}
         and purpose = 'password_reset'
         and consumed_at is null
         and expires_at > now()
    `);
    const row = rows[0];
    if (!row) throw new ApiException("validation", "That reset link has expired.");
    if (!this.passwords.acceptable(newPassword, [row.email.split("@")[0]])) {
      throw new ApiException("validation", "Choose a longer, less common password.");
    }

    const hash = await this.passwords.hash(newPassword);
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        insert into credentials (user_id, password_hash, changed_at)
        values (${row.user_id}, ${hash}, now())
        on conflict (user_id) do update set password_hash = ${hash}, changed_at = now()
      `);
      await tx.execute(sql`update email_tokens set consumed_at = now() where id = ${row.id}`);
    });

    // Anyone holding an old session may be the reason the reset was needed.
    await this.sessions.revokeAllForUser(row.user_id);
    await this.lockout.clear(row.email);
  }

  async verifyEmail(token: string): Promise<void> {
    const rows = await this.db.execute<{ id: string; user_id: string; email: string }>(sql`
      select id, user_id, email from email_tokens
       where token_hash = ${hashToken(token)}
         and purpose = 'verify_email'
         and consumed_at is null
         and expires_at > now()
    `);
    const row = rows[0];
    if (!row) throw new ApiException("validation", "That verification link has expired.");
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        update users set email_verified_at = now(), email = ${row.email} where id = ${row.user_id}
      `);
      await tx.execute(sql`update email_tokens set consumed_at = now() where id = ${row.id}`);
    });
  }

  private async issuePendingToken(userId: string, email: string): Promise<string> {
    const { raw, hash } = issueToken();
    const expires = new Date(Date.now() + 5 * 60_000);
    await this.db.execute(sql`
      insert into email_tokens (user_id, purpose, token_hash, email, expires_at)
      values (${userId}, 'totp_pending', ${hash}, ${email}, ${expires.toISOString()})
    `);
    return raw;
  }

  private async sendEmailToken(
    userId: string,
    email: string,
    purpose: "verify_email" | "password_reset",
    minutes: number,
  ): Promise<void> {
    const { raw, hash } = issueToken();
    const expires = new Date(Date.now() + minutes * 60_000);
    await this.db.execute(sql`
      insert into email_tokens (user_id, purpose, token_hash, email, expires_at)
      values (${userId}, ${purpose}, ${hash}, ${email}, ${expires.toISOString()})
    `);

    const path = purpose === "verify_email" ? "verify" : "reset/new";
    const link = `${this.env.APP_ORIGIN}/${path}?token=${raw}`;
    await this.email.send({
      to: email,
      subject: purpose === "verify_email" ? "Confirm your email" : "Reset your password",
      body: link,
    });
  }

  initials = initialsOf;
}
