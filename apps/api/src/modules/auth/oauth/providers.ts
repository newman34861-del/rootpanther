import type { OauthProvider } from "@rootpanther/contracts";

export interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  /** GitHub returns form-encoded unless asked otherwise. */
  tokenAccept: string;
}

export const PROVIDERS: Record<OauthProvider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    tokenAccept: "application/json",
  },
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile",
    tokenAccept: "application/json",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userinfoUrl: "https://api.github.com/user",
    scope: "read:user user:email",
    tokenAccept: "application/json",
  },
};

export interface ProviderProfile {
  providerAccountId: string;
  email: string | null;
  /**
   * Whether the provider asserts the address is theirs. An unverified address is never
   * used to attach a sign-in to an existing account, because anyone can claim one.
   */
  emailVerified: boolean;
  name: string | null;
  label: string | null;
}

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export async function fetchProfile(
  provider: OauthProvider,
  accessToken: string,
): Promise<ProviderProfile> {
  const config = PROVIDERS[provider];
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "user-agent": "rootpanther",
  };

  const res = await fetch(config.userinfoUrl, { headers });
  if (!res.ok) throw new Error(`${provider} userinfo returned ${res.status}`);
  const body = (await res.json()) as Json;

  if (provider === "github") {
    // GitHub omits the address from /user when it is private, and does not say whether
    // it is verified, so the verified primary is read from the dedicated endpoint.
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
    let email: string | null = null;
    let verified = false;
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      email = primary?.email ?? null;
      verified = Boolean(primary);
    }
    return {
      providerAccountId: String(body.id ?? ""),
      email,
      emailVerified: verified,
      name: str(body.name) ?? str(body.login),
      label: str(body.login),
    };
  }

  // Google and Microsoft both return OpenID Connect claims.
  const email = str(body.email);
  return {
    providerAccountId: String(body.sub ?? ""),
    email,
    // Microsoft's userinfo omits email_verified. A work or school account only carries an
    // address the tenant controls, so it is treated as asserted by the issuer.
    emailVerified: provider === "google" ? body.email_verified === true : Boolean(email),
    name: str(body.name),
    label: email,
  };
}
