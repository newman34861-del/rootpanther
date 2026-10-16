import { Inject, Injectable } from "@nestjs/common";
import { AUTH_POLICY } from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { DB } from "../../db/db.module";
import type { Database } from "../../db/client";
import { PasswordService } from "./password.service";
import { generateRecoveryCode } from "./tokens";

const ISSUER = "Rootpanther";

@Injectable()
export class TotpService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly passwords: PasswordService,
  ) {}

  private build(secret: string, email: string) {
    return new OTPAuth.TOTP({
      issuer: ISSUER,
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  }

  /**
   * Stores the secret before it is confirmed, with enabled_at left null. Two factor is
   * not in force until a code proves the authenticator actually holds the same secret,
   * so a half-finished setup cannot lock the learner out.
   */
  async beginSetup(userId: string, email: string) {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    await this.db.execute(sql`
      insert into totp_secrets (user_id, secret, enabled_at)
      values (${userId}, ${secret}, null)
      on conflict (user_id) do update set secret = ${secret}, enabled_at = null
    `);
    return { secret, otpauth: this.build(secret, email).toString() };
  }

  async confirmSetup(userId: string, email: string, code: string): Promise<string[] | null> {
    const secret = await this.secretFor(userId);
    if (!secret) return null;
    if (!this.build(secret, email).validate({ token: code, window: 1 })) return null;

    await this.db.execute(sql`
      update totp_secrets set enabled_at = now() where user_id = ${userId}
    `);
    return this.regenerateRecoveryCodes(userId);
  }

  async verify(userId: string, email: string, code: string): Promise<boolean> {
    const secret = await this.secretFor(userId, true);
    if (!secret) return false;
    // A window of one step tolerates clock drift without widening the guess space much.
    return this.build(secret, email).validate({ token: code, window: 1 }) !== null;
  }

  async disable(userId: string): Promise<void> {
    await this.db.execute(sql`delete from totp_secrets where user_id = ${userId}`);
    await this.db.execute(sql`delete from recovery_codes where user_id = ${userId}`);
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    await this.db.execute(sql`delete from recovery_codes where user_id = ${userId}`);
    const codes: string[] = [];
    for (let i = 0; i < AUTH_POLICY.recoveryCodeCount; i += 1) codes.push(generateRecoveryCode());
    for (const code of codes) {
      const hash = await this.passwords.hash(code);
      await this.db.execute(sql`
        insert into recovery_codes (user_id, code_hash) values (${userId}, ${hash})
      `);
    }
    return codes;
  }

  /** Consumes a recovery code. Each one works once, so a used code cannot be replayed. */
  async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const rows = await this.db.execute<{ id: string; code_hash: string }>(sql`
      select id, code_hash from recovery_codes where user_id = ${userId} and used_at is null
    `);
    for (const row of rows) {
      if (await this.passwords.verify(row.code_hash, code)) {
        await this.db.execute(sql`
          update recovery_codes set used_at = now() where id = ${row.id} and used_at is null
        `);
        return true;
      }
    }
    return false;
  }

  async status(userId: string) {
    const totp = await this.db.execute<{ enabled_at: Date | null }>(sql`
      select enabled_at from totp_secrets where user_id = ${userId}
    `);
    const left = await this.db.execute<{ count: string }>(sql`
      select count(*)::text as count from recovery_codes
       where user_id = ${userId} and used_at is null
    `);
    const enabledAt = totp[0]?.enabled_at ?? null;
    return {
      enabled: Boolean(enabledAt),
      enabledAt: enabledAt ? new Date(enabledAt).toISOString() : null,
      codesLeft: Number(left[0]?.count ?? 0),
    };
  }

  private async secretFor(userId: string, mustBeEnabled = false): Promise<string | null> {
    const rows = await this.db.execute<{ secret: string; enabled_at: Date | null }>(sql`
      select secret, enabled_at from totp_secrets where user_id = ${userId}
    `);
    const row = rows[0];
    if (!row) return null;
    if (mustBeEnabled && !row.enabled_at) return null;
    return row.secret;
  }
}
