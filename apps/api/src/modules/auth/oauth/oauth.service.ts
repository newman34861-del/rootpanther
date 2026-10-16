import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { ConnectedAccount, OauthProvider } from "@rootpanther/contracts";
import { sql } from "drizzle-orm";
import { ApiException } from "../../../common/errors";
import { ENV } from "../../../config/config.module";
import type { Env } from "../../../config/env";
import { DB } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import { withOrg } from "../../../db/tenancy";
import { PROVIDERS, fetchProfile, type ProviderProfile } from "./providers";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function publicId(prefix: string, length = 8): string {
  let out = "";
  for (const byte of randomBytes(length)) out += ID_ALPHABET[byte % ID_ALPHABET.length];
  return `${prefix}_${out}`;
}

export interface OauthStart {
  url: string;
  state: string;
  verifier: string;
}

export interface OauthOutcome {
  userId: string;
  created: boolean;
}

@Injectable()
export class OauthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private credentials(provider: OauthProvider): { id: string; secret: string } {
    const id = this.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID` as keyof Env] as
      | string
      | undefined;
    const secret = this.env[`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET` as keyof Env] as
      | string
      | undefined;
    if (!id || !secret) {
      throw new ApiException("upstream", "That sign-in provider is not configured.");
    }
    return { id, secret };
  }

  redirectUri(provider: OauthProvider): string {
    return `${this.env.API_ORIGIN}/auth/oauth/${provider}/callback`;
  }

  /**
   * Builds the authorize URL with PKCE. The verifier never leaves our side until the
   * exchange, so an intercepted authorization code cannot be redeemed by anyone else.
   */
  start(provider: OauthProvider): OauthStart {
    const { id } = this.credentials(provider);
    const config = PROVIDERS[provider];
    const state = randomBytes(16).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    const url = new URL(config.authorizeUrl);
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", this.redirectUri(provider));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scope);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return { url: url.toString(), state, verifier };
  }

  async exchange(
    provider: OauthProvider,
    code: string,
    verifier: string,
  ): Promise<ProviderProfile> {
    const { id, secret } = this.credentials(provider);
    const config = PROVIDERS[provider];

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: config.tokenAccept,
      },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri(provider),
        code_verifier: verifier,
      }),
    });

    if (!res.ok) throw new ApiException("upstream", "That sign-in could not be completed.");
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) {
      throw new ApiException("upstream", "That sign-in could not be completed.");
    }
    return fetchProfile(provider, body.access_token);
  }

  /**
   * Resolves a provider profile to an account.
   *
   * Three cases, in order. An already-linked provider account signs in. Otherwise a
   * verified address that matches an existing account attaches to it. Otherwise a new
   * account is created. The middle case is restricted to verified addresses because an
   * unverified one would let anyone who can assert an address take over the account that
   * owns it.
   */
  async resolve(provider: OauthProvider, profile: ProviderProfile): Promise<OauthOutcome> {
    if (!profile.providerAccountId) {
      throw new ApiException("upstream", "That provider did not identify the account.");
    }

    const linked = await this.db.execute<{ user_id: string }>(sql`
      select user_id from oauth_accounts
       where provider = ${provider} and provider_account_id = ${profile.providerAccountId}
    `);
    if (linked[0]) return { userId: linked[0].user_id, created: false };

    if (profile.email && profile.emailVerified) {
      const existing = await this.db.execute<{ id: string }>(sql`
        select id from users where email = ${profile.email.toLowerCase()}
      `);
      if (existing[0]) {
        await this.link(existing[0].id, provider, profile);
        return { userId: existing[0].id, created: false };
      }
    }

    if (!profile.email) {
      throw new ApiException(
        "validation",
        "That account has no email address we can use. Add one with the provider, or sign up with an email.",
      );
    }

    // The address is already held by an account, but the provider did not vouch for it.
    // Attaching here would hand that account to whoever claimed the address, so the
    // learner is asked to sign in first and link the provider from their settings.
    const taken = await this.db.execute<{ id: string }>(sql`
      select id from users where email = ${profile.email.toLowerCase()}
    `);
    if (taken[0]) {
      throw new ApiException(
        "conflict",
        "An account already uses that email. Sign in, then link this provider from Security settings.",
      );
    }

    const name = profile.name ?? profile.email.split("@")[0];
    const orgId = randomUUID();
    const userId = await withOrg(this.db, orgId, async (tx) => {
      await tx.execute(sql`
        insert into organizations (id, public_id, name, personal)
        values (${orgId}, ${publicId("org")}, ${name}, true)
      `);
      const users = await tx.execute<{ id: string }>(sql`
        insert into users (public_id, email, name, email_verified_at)
        values (
          ${publicId("usr")}, ${profile.email!.toLowerCase()}, ${name},
          ${profile.emailVerified ? sql`now()` : sql`null`}
        )
        returning id
      `);
      const id = users[0].id;
      await tx.execute(sql`
        insert into memberships (org_id, user_id, role) values (${orgId}, ${id}, 'learner')
      `);
      return id;
    });

    await this.link(userId, provider, profile);
    return { userId, created: true };
  }

  async link(userId: string, provider: OauthProvider, profile: ProviderProfile): Promise<void> {
    await this.db.execute(sql`
      insert into oauth_accounts (user_id, provider, provider_account_id, account_label)
      values (${userId}, ${provider}, ${profile.providerAccountId}, ${profile.label})
      on conflict (provider, provider_account_id) do update set account_label = ${profile.label}
    `);
  }

  /**
   * Refuses to remove the last way in. An account with no password and one provider
   * would become unreachable, which is a support problem, not a security feature.
   */
  async unlink(userId: string, provider: OauthProvider): Promise<void> {
    const rows = await this.db.execute<{ providers: string; has_password: boolean }>(sql`
      select
        (select count(*)::text from oauth_accounts where user_id = ${userId}) as providers,
        exists(select 1 from credentials where user_id = ${userId}) as has_password
    `);
    const row = rows[0];
    const providerCount = Number(row?.providers ?? 0);
    if (!row?.has_password && providerCount <= 1) {
      throw new ApiException(
        "conflict",
        "Set a password before removing your only way to sign in.",
      );
    }
    await this.db.execute(sql`
      delete from oauth_accounts where user_id = ${userId} and provider = ${provider}
    `);
  }

  async listFor(userId: string): Promise<ConnectedAccount[]> {
    const rows = await this.db.execute<{
      provider: string;
      account_label: string | null;
      linked_at: Date;
    }>(sql`
      select provider, account_label, linked_at from oauth_accounts where user_id = ${userId}
    `);
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return (Object.keys(PROVIDERS) as OauthProvider[]).map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        linked: Boolean(row),
        account: row?.account_label ?? null,
        linkedAt: row ? new Date(row.linked_at).toISOString() : null,
      };
    });
  }
}
