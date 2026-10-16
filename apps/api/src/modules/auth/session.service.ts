import { Inject, Injectable } from "@nestjs/common";
import { AUTH_POLICY, type DeviceSession } from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { DB } from "../../db/db.module";
import type { Database } from "../../db/client";
import { hashToken, issueToken } from "./tokens";

export interface SessionContext {
  sessionId: string;
  userId: string;
  impersonatedBy: string | null;
}

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

function deviceKind(ua: string | undefined): DeviceSession["kind"] {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|iphone|android/.test(s)) return "mobile";
  if (/macintosh|windows|linux|x11/.test(s)) return "laptop";
  return "unknown";
}

function deviceLabel(ua: string | undefined): string | null {
  if (!ua) return null;
  const browser = /firefox/i.test(ua)
    ? "Firefox"
    : /edg/i.test(ua)
      ? "Edge"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "Browser";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /macintosh|mac os/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad|ios/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : null;
  return os ? `${browser} on ${os}` : browser;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async issue(userId: string, meta: RequestMeta, impersonatedBy: string | null = null) {
    const { raw, hash } = issueToken();
    const expires = new Date(Date.now() + AUTH_POLICY.sessionDays * 86_400_000);
    await this.db.execute(sql`
      insert into auth_sessions (user_id, token_hash, device, kind, ip, expires_at, impersonated_by)
      values (
        ${userId}, ${hash}, ${deviceLabel(meta.userAgent)}, ${deviceKind(meta.userAgent)},
        ${meta.ip ?? null}, ${expires.toISOString()}, ${impersonatedBy}
      )
    `);
    return { token: raw, expiresAt: expires };
  }

  /** Resolves a cookie to a session and records activity. Expired rows never resolve. */
  async verify(rawToken: string): Promise<SessionContext | null> {
    const rows = await this.db.execute<{
      id: string;
      user_id: string;
      impersonated_by: string | null;
    }>(sql`
      update auth_sessions
         set last_active_at = now()
       where token_hash = ${hashToken(rawToken)}
         and expires_at > now()
      returning id, user_id, impersonated_by
    `);
    const row = rows[0];
    if (!row) return null;
    return { sessionId: row.id, userId: row.user_id, impersonatedBy: row.impersonated_by };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.execute(sql`delete from auth_sessions where id = ${sessionId}`);
  }

  async revokeByToken(rawToken: string): Promise<void> {
    await this.db.execute(sql`delete from auth_sessions where token_hash = ${hashToken(rawToken)}`);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.db.execute(sql`
      delete from auth_sessions
       where user_id = ${userId}
         and (${exceptSessionId ?? null}::uuid is null or id <> ${exceptSessionId ?? null}::uuid)
    `);
  }

  async list(userId: string, currentSessionId: string): Promise<DeviceSession[]> {
    const rows = await this.db.execute<{
      id: string;
      device: string | null;
      kind: string | null;
      location: string | null;
      ip: string | null;
      last_active_at: Date;
    }>(sql`
      select id, device, kind, location, ip, last_active_at
        from auth_sessions
       where user_id = ${userId} and expires_at > now()
       order by last_active_at desc
    `);
    return rows.map((r) => ({
      id: r.id,
      device: r.device,
      kind: (r.kind ?? "unknown") as DeviceSession["kind"],
      location: r.location,
      ip: r.ip,
      lastActive: new Date(r.last_active_at).toISOString(),
      current: r.id === currentSessionId,
    }));
  }
}
