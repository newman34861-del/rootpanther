import { Inject, Injectable } from "@nestjs/common";
import {
  LAB_DEFAULTS,
  PREFERENCE_DEFAULTS,
  RESERVED_HANDLES,
  type AccountFootprint,
  type HandleAvailability,
  type LabDefaults,
  type Preferences,
  type Profile,
  type ProfileUpdate,
} from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { ApiException } from "../../common/errors";
import type { Database } from "../../db/client";
import { DB } from "../../db/db.module";

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}$/;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ProfileRow = {
  public_id: string;
  email: string;
  email_verified_at: Date | null;
  pending_email: string | null;
  name: string;
  handle: string | null;
  country: string | null;
  avatar_url: string | null;
  created_at: Date;
  deletion_scheduled_for: Date | null;
};

type PreferenceRow = {
  help_default: string;
  terminal_font_size: number;
  terminal_theme: string;
  email_session_expiry: boolean;
  email_debrief_ready: boolean;
  email_new_scenarios: boolean;
  email_billing: boolean;
};

type LabDefaultsRow = {
  connection: string;
  teardown: string;
  ssh_key: string | null;
};

@Injectable()
export class AccountService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async profile(userId: string): Promise<Profile> {
    const rows = await this.db.execute<ProfileRow>(sql`
      select public_id, email, email_verified_at, pending_email, name, handle, country,
             avatar_url, created_at, deletion_scheduled_for
        from users
       where id = ${userId}
    `);
    const row = rows[0];
    if (!row) throw new ApiException("not-found", "That account no longer exists.");
    return {
      id: row.public_id,
      name: row.name,
      email: row.email,
      emailVerified: row.email_verified_at !== null,
      pendingEmail: row.pending_email,
      country: row.country,
      handle: row.handle,
      avatarUrl: row.avatar_url,
      initials: initialsOf(row.name),
      memberSince: new Date(row.created_at).toISOString(),
      deletionScheduledFor: row.deletion_scheduled_for
        ? new Date(row.deletion_scheduled_for).toISOString()
        : null,
    };
  }

  async updateProfile(userId: string, input: ProfileUpdate): Promise<Profile> {
    if (input.handle !== undefined) {
      const verdict = await this.handleAvailability(userId, input.handle);
      // "unchanged" means it is already this account's handle, which is not a conflict.
      if (!verdict.available && verdict.reason !== "unchanged") {
        throw new ApiException("conflict", "That handle is not available.", {
          handle:
            verdict.reason === "reserved"
              ? "That handle is reserved."
              : verdict.reason === "malformed"
                ? "Use lowercase letters, numbers and hyphens."
                : "Someone already has that handle.",
        });
      }
    }

    // Each field is written only when the caller sent it, so a form that submits one
    // field does not blank the others. avatarUrl is the exception: null is a value there
    // and means remove the picture, so absent and null have to stay distinguishable.
    await this.db.execute(sql`
      update users
         set name = coalesce(${input.name ?? null}::text, name),
             handle = coalesce(${input.handle?.toLowerCase() ?? null}::text, handle),
             country = coalesce(${input.country?.toUpperCase() ?? null}::text, country),
             avatar_url = ${
               input.avatarUrl === undefined ? sql`avatar_url` : sql`${input.avatarUrl}::text`
             }
       where id = ${userId}
    `);
    return this.profile(userId);
  }

  /**
   * Decides a handle without writing it, so the form can say why before submitting.
   * Checked against the same rules the update applies, because a form that disagrees
   * with the server is worse than one that does not check at all.
   */
  async handleAvailability(userId: string, raw: string): Promise<HandleAvailability> {
    const handle = raw.trim().toLowerCase();
    if (!HANDLE_PATTERN.test(handle)) {
      return { handle, available: false, reason: "malformed" };
    }
    if ((RESERVED_HANDLES as readonly string[]).includes(handle)) {
      return { handle, available: false, reason: "reserved" };
    }
    const rows = await this.db.execute<{ id: string }>(sql`
      select id from users where lower(handle) = ${handle}
    `);
    const owner = rows[0];
    if (!owner) return { handle, available: true, reason: null };
    if (owner.id === userId) return { handle, available: false, reason: "unchanged" };
    return { handle, available: false, reason: "taken" };
  }

  async preferences(userId: string): Promise<Preferences> {
    const rows = await this.db.execute<PreferenceRow>(sql`
      select help_default, terminal_font_size, terminal_theme, email_session_expiry,
             email_debrief_ready, email_new_scenarios, email_billing
        from user_preferences
       where user_id = ${userId}
    `);
    const row = rows[0];
    // No row means the learner has never opened the settings page. The defaults are the
    // answer, rather than a 404 the page would have to special-case.
    if (!row) return PREFERENCE_DEFAULTS;
    return {
      helpDefault: row.help_default as Preferences["helpDefault"],
      terminalFontSize: row.terminal_font_size,
      terminalTheme: row.terminal_theme as Preferences["terminalTheme"],
      email: {
        sessionExpiry: row.email_session_expiry,
        debriefReady: row.email_debrief_ready,
        newScenarios: row.email_new_scenarios,
        billing: row.email_billing,
      },
    };
  }

  async savePreferences(userId: string, input: Preferences): Promise<Preferences> {
    await this.db.execute(sql`
      insert into user_preferences (
        user_id, help_default, terminal_font_size, terminal_theme,
        email_session_expiry, email_debrief_ready, email_new_scenarios, email_billing
      ) values (
        ${userId}, ${input.helpDefault}, ${input.terminalFontSize}, ${input.terminalTheme},
        ${input.email.sessionExpiry}, ${input.email.debriefReady},
        ${input.email.newScenarios}, ${input.email.billing}
      )
      on conflict (user_id) do update set
        help_default = excluded.help_default,
        terminal_font_size = excluded.terminal_font_size,
        terminal_theme = excluded.terminal_theme,
        email_session_expiry = excluded.email_session_expiry,
        email_debrief_ready = excluded.email_debrief_ready,
        email_new_scenarios = excluded.email_new_scenarios,
        email_billing = excluded.email_billing,
        updated_at = now()
    `);
    return this.preferences(userId);
  }

  async labDefaults(userId: string): Promise<LabDefaults> {
    const rows = await this.db.execute<LabDefaultsRow>(sql`
      select connection, teardown, ssh_key from lab_defaults where user_id = ${userId}
    `);
    const row = rows[0];
    if (!row) return LAB_DEFAULTS;
    return {
      connection: row.connection as LabDefaults["connection"],
      teardown: row.teardown as LabDefaults["teardown"],
      sshKey: row.ssh_key,
    };
  }

  async saveLabDefaults(userId: string, input: LabDefaults): Promise<LabDefaults> {
    const sshKey = input.sshKey === null ? null : normaliseSshKey(input.sshKey);
    await this.db.execute(sql`
      insert into lab_defaults (user_id, connection, teardown, ssh_key)
      values (${userId}, ${input.connection}, ${input.teardown}, ${sshKey})
      on conflict (user_id) do update set
        connection = excluded.connection,
        teardown = excluded.teardown,
        ssh_key = excluded.ssh_key,
        updated_at = now()
    `);
    return this.labDefaults(userId);
  }

  /**
   * What deleting the account would destroy. Counted live rather than kept as a running
   * total, because a stale number here is one the learner would act on.
   */
  async footprint(userId: string): Promise<AccountFootprint> {
    void userId;
    // The tables these count come with lab orchestration, Onyx and reports. Zero is the
    // true answer until they exist, and is replaced one count at a time as they land.
    return { labSessions: 0, proofs: 0, reports: 0, debriefs: 0, onyxConversations: 0 };
  }
}

/**
 * Accepts a public key the way a learner pastes it, which is usually with a trailing
 * newline from a terminal copy and sometimes with the comment missing.
 */
export function normaliseSshKey(raw: string): string {
  const key = raw.trim().replace(/\s+/g, " ");
  // Checked before the shape test so the learner who pastes the wrong half of the pair
  // is told which half, rather than that the key is unrecognisable.
  if (key.startsWith("-----BEGIN")) {
    throw new ApiException("validation", "That is a private key.", {
      sshKey: "Paste the .pub file, not the key itself.",
    });
  }
  const [type, body] = key.split(" ");
  const accepted = [
    "ssh-ed25519",
    "ssh-rsa",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
  ];
  if (!accepted.includes(type ?? "") || !body) {
    throw new ApiException("validation", "That does not look like a public key.", {
      sshKey: "Paste the contents of a .pub file.",
    });
  }
  if (type === "ssh-rsa" && Buffer.from(body, "base64").length < 256) {
    throw new ApiException("validation", "That RSA key is too short.", {
      sshKey: "Use at least 2048 bits, or an ed25519 key.",
    });
  }
  return key;
}
