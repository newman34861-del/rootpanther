import { Inject, Injectable } from "@nestjs/common";
import { AUTH_POLICY } from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { DB } from "../../db/db.module";
import type { Database } from "../../db/client";

export interface LockState {
  locked: boolean;
  until: Date | null;
  attemptsLeft: number;
}

@Injectable()
export class LockoutService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async state(identifier: string): Promise<LockState> {
    const rows = await this.db.execute<{ failures: number; locked_until: Date | null }>(
      sql`select failures, locked_until from login_attempts where identifier = ${identifier}`,
    );
    const row = rows[0];
    if (!row) return { locked: false, until: null, attemptsLeft: AUTH_POLICY.attemptsBeforeLock };

    const until = row.locked_until ? new Date(row.locked_until) : null;
    if (until && until.getTime() > Date.now()) {
      return { locked: true, until, attemptsLeft: 0 };
    }
    return {
      locked: false,
      until: null,
      attemptsLeft: Math.max(0, AUTH_POLICY.attemptsBeforeLock - row.failures),
    };
  }

  /**
   * Counts a failure and locks once the threshold is reached. The counter is keyed on
   * the submitted identifier rather than on a resolved account, so an unknown address
   * behaves identically to a real one and cannot be used to probe for members.
   */
  async recordFailure(identifier: string): Promise<LockState> {
    const lockFor = `${AUTH_POLICY.lockMinutes} minutes`;
    const rows = await this.db.execute<{ failures: number; locked_until: Date | null }>(sql`
      insert into login_attempts (identifier, failures, updated_at)
      values (${identifier}, 1, now())
      on conflict (identifier) do update set
        failures = case
          when login_attempts.locked_until is not null and login_attempts.locked_until < now()
            then 1
          else login_attempts.failures + 1
        end,
        locked_until = case
          when (case
                  when login_attempts.locked_until is not null and login_attempts.locked_until < now()
                    then 1
                  else login_attempts.failures + 1
                end) >= ${AUTH_POLICY.attemptsBeforeLock}
            then now() + ${sql.raw(`interval '${lockFor}'`)}
          else null
        end,
        updated_at = now()
      returning failures, locked_until
    `);
    const row = rows[0];
    const until = row?.locked_until ? new Date(row.locked_until) : null;
    return {
      locked: Boolean(until && until.getTime() > Date.now()),
      until,
      attemptsLeft: Math.max(0, AUTH_POLICY.attemptsBeforeLock - (row?.failures ?? 0)),
    };
  }

  async clear(identifier: string): Promise<void> {
    await this.db.execute(sql`delete from login_attempts where identifier = ${identifier}`);
  }
}
