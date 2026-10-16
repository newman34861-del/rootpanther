import { Inject, Injectable } from "@nestjs/common";
import type { SecurityState } from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { ApiException } from "../../common/errors";
import type { Database } from "../../db/client";
import { DB } from "../../db/db.module";
import { OauthService } from "../auth/oauth/oauth.service";
import { PasswordService } from "../auth/password.service";
import { SessionService } from "../auth/session.service";
import { TotpService } from "../auth/totp.service";

@Injectable()
export class SecurityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly totp: TotpService,
    private readonly oauth: OauthService,
  ) {}

  async state(userId: string, currentSessionId: string): Promise<SecurityState> {
    const [credential] = await this.db.execute<{ changed_at: Date }>(sql`
      select changed_at from credentials where user_id = ${userId}
    `);
    const [twoFactor, sessions, accounts] = await Promise.all([
      this.totp.status(userId),
      this.sessions.list(userId, currentSessionId),
      this.oauth.listFor(userId),
    ]);
    return {
      hasPassword: Boolean(credential),
      passwordChangedAt: credential ? new Date(credential.changed_at).toISOString() : null,
      twoFactor,
      sessions,
      accounts,
    };
  }

  /**
   * Sets a password, or changes one. An account that signed up through a provider has
   * none, which is why the current password is required only when there is one to give:
   * demanding it would otherwise make the account impossible to add a password to.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    input: { currentPassword?: string; newPassword: string },
  ): Promise<void> {
    const [existing] = await this.db.execute<{ password_hash: string }>(sql`
      select password_hash from credentials where user_id = ${userId}
    `);
    if (existing) {
      const ok =
        input.currentPassword !== undefined &&
        (await this.passwords.verify(existing.password_hash, input.currentPassword));
      if (!ok) {
        throw new ApiException("unauthenticated", "That is not your current password.", {
          currentPassword: "Does not match.",
        });
      }
    }

    const [user] = await this.db.execute<{ email: string; name: string }>(sql`
      select email, name from users where id = ${userId}
    `);
    if (!this.passwords.acceptable(input.newPassword, [user?.email.split("@")[0], user?.name])) {
      throw new ApiException("validation", "Choose a longer, less common password.", {
        newPassword: "Too easy to guess.",
      });
    }

    const hash = await this.passwords.hash(input.newPassword);
    await this.db.execute(sql`
      insert into credentials (user_id, password_hash, changed_at)
      values (${userId}, ${hash}, now())
      on conflict (user_id) do update set password_hash = ${hash}, changed_at = now()
    `);

    // Every other device is signed out. Whoever prompted the change may be holding one
    // of them, and the device doing the changing is the one we can be sure about.
    await this.sessions.revokeAllForUser(userId, currentSessionId);
  }

  /** Revokes one device. Refuses to touch a session belonging to somebody else. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const rows = await this.db.execute<{ id: string }>(sql`
      select id from auth_sessions where id = ${sessionId} and user_id = ${userId}
    `);
    // Reported as missing rather than forbidden: confirming that a session id exists but
    // belongs to someone else is more than the caller needs to know.
    if (!rows[0]) throw new ApiException("not-found", "That device is already signed out.");
    await this.sessions.revoke(sessionId);
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId, currentSessionId);
  }

  async beginTotp(userId: string) {
    const status = await this.totp.status(userId);
    if (status.enabled) {
      throw new ApiException("conflict", "Two-factor authentication is already on.");
    }
    const [user] = await this.db.execute<{ email: string }>(sql`
      select email from users where id = ${userId}
    `);
    if (!user) throw new ApiException("not-found", "That account no longer exists.");
    return this.totp.beginSetup(userId, user.email);
  }

  async confirmTotp(userId: string, code: string): Promise<string[]> {
    const [user] = await this.db.execute<{ email: string }>(sql`
      select email from users where id = ${userId}
    `);
    if (!user) throw new ApiException("not-found", "That account no longer exists.");
    const codes = await this.totp.confirmSetup(userId, user.email, code);
    if (!codes) throw new ApiException("validation", "That code is not valid.", { code: "Try again." });
    return codes;
  }

  /**
   * Turning two factor off needs proof of the first factor again. Otherwise a borrowed
   * open browser is enough to remove it, which is the attack two factor exists to stop.
   */
  async disableTotp(userId: string, currentPassword: string | undefined): Promise<void> {
    const [existing] = await this.db.execute<{ password_hash: string }>(sql`
      select password_hash from credentials where user_id = ${userId}
    `);
    if (existing) {
      const ok =
        currentPassword !== undefined &&
        (await this.passwords.verify(existing.password_hash, currentPassword));
      if (!ok) {
        throw new ApiException("unauthenticated", "That is not your current password.", {
          currentPassword: "Does not match.",
        });
      }
    }
    await this.totp.disable(userId);
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const status = await this.totp.status(userId);
    if (!status.enabled) {
      throw new ApiException("conflict", "Turn on two-factor authentication first.");
    }
    return this.totp.regenerateRecoveryCodes(userId);
  }
}
