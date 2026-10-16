import { Controller, Delete, Get, Inject, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { AUTH_POLICY, oauthProvider, type OauthProvider } from "@rootpanther/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiException } from "../../../common/errors";
import { ENV } from "../../../config/config.module";
import type { Env } from "../../../config/env";
import { AuthGuard, CurrentSession, SESSION_COOKIE } from "../auth.guard";
import { SessionService, type SessionContext } from "../session.service";
import { OauthService } from "./oauth.service";

const STATE_COOKIE = "rp_oauth";

interface StatePayload {
  provider: OauthProvider;
  state: string;
  verifier: string;
  /** Set when an already signed-in learner is attaching a provider to their account. */
  linkUserId?: string;
}

@Controller("auth/oauth")
export class OauthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly oauth: OauthService,
    private readonly sessions: SessionService,
  ) {}

  private parseProvider(value: string): OauthProvider {
    const parsed = oauthProvider.safeParse(value);
    if (!parsed.success) throw new ApiException("not-found", "Unknown sign-in provider.");
    return parsed.data;
  }

  private cookieBase() {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.env.NODE_ENV === "production",
      domain: this.env.COOKIE_DOMAIN,
      path: "/",
    };
  }

  @Get(":provider/start")
  async start(
    @Param("provider") providerParam: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const provider = this.parseProvider(providerParam);
    const { url, state, verifier } = this.oauth.start(provider);

    // An existing session means the learner is attaching a provider rather than signing
    // in, so the outcome is a link against their account, never a different one.
    let linkUserId: string | undefined;
    const existing = req.cookies?.[SESSION_COOKIE];
    if (existing) {
      const session = await this.sessions.verify(existing);
      if (session) linkUserId = session.userId;
    }

    const payload: StatePayload = { provider, state, verifier, linkUserId };
    reply.setCookie(STATE_COOKIE, JSON.stringify(payload), {
      ...this.cookieBase(),
      signed: true,
      maxAge: 600,
    });
    return reply.redirect(url, 302);
  }

  @Get(":provider/callback")
  async callback(
    @Param("provider") providerParam: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const provider = this.parseProvider(providerParam);
    const fail = (reason: string) =>
      reply.redirect(`${this.env.APP_ORIGIN}/signin?error=${reason}`, 302);

    const raw = req.cookies?.[STATE_COOKIE];
    if (!raw || !code || !state) return fail("expired");

    const unsigned = reply.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return fail("expired");

    let payload: StatePayload;
    try {
      payload = JSON.parse(unsigned.value) as StatePayload;
    } catch {
      return fail("expired");
    }

    reply.clearCookie(STATE_COOKIE, { domain: this.env.COOKIE_DOMAIN, path: "/" });

    // The state must match the value this browser was issued. Without it, an attacker
    // could have the learner complete a flow the attacker began.
    if (payload.provider !== provider || payload.state !== state) return fail("state");

    let userId: string;
    try {
      const profile = await this.oauth.exchange(provider, code, payload.verifier);
      if (payload.linkUserId) {
        await this.oauth.link(payload.linkUserId, provider, profile);
        return reply.redirect(`${this.env.APP_ORIGIN}/settings/security?linked=${provider}`, 302);
      }
      userId = (await this.oauth.resolve(provider, profile)).userId;
    } catch (err) {
      return fail(err instanceof ApiException && err.code === "validation" ? "no-email" : "failed");
    }

    const issued = await this.sessions.issue(userId, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    reply.setCookie(SESSION_COOKIE, issued.token, {
      ...this.cookieBase(),
      maxAge: AUTH_POLICY.sessionDays * 86_400,
    });
    return reply.redirect(this.env.APP_ORIGIN, 302);
  }

  @Get("accounts")
  @UseGuards(AuthGuard)
  async accounts(@CurrentSession() session: SessionContext) {
    return this.oauth.listFor(session.userId);
  }

  @Delete("accounts/:provider")
  @UseGuards(AuthGuard)
  async unlink(
    @Param("provider") providerParam: string,
    @CurrentSession() session: SessionContext,
  ) {
    const provider = this.parseProvider(providerParam);
    await this.oauth.unlink(session.userId, provider);
    return { status: "unlinked" };
  }
}
