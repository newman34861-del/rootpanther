import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import {
  AUTH_POLICY,
  emailOnly,
  recoveryCode,
  resetConfirm,
  signInRequest,
  signUpRequest,
  totpCode,
  type SignInResult,
} from "@rootpanther/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { ZodPipe } from "../../common/zod.pipe";
import { AuthService } from "./auth.service";
import {
  AuthGuard,
  CurrentSession,
  PENDING_COOKIE,
  SESSION_COOKIE,
} from "./auth.guard";
import { SessionService, type SessionContext } from "./session.service";

function meta(req: FastifyRequest) {
  return { userAgent: req.headers["user-agent"], ip: req.ip };
}

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  private cookieOptions(maxAgeSeconds: number) {
    return {
      httpOnly: true,
      // Lax is sufficient because app, portal and api are all on the same site. The
      // cookie is therefore never sent from a third-party context.
      sameSite: "lax" as const,
      secure: this.env.NODE_ENV === "production",
      domain: this.env.COOKIE_DOMAIN,
      path: "/",
      maxAge: maxAgeSeconds,
    };
  }

  @Post("signup")
  async signUp(
    @Body(new ZodPipe(signUpRequest)) body: { name: string; email: string; password: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const issued = await this.auth.signUp(body, meta(req));
    reply.setCookie(SESSION_COOKIE, issued.token, this.cookieOptions(AUTH_POLICY.sessionDays * 86_400));
    return { status: "authenticated" } satisfies SignInResult;
  }

  @Post("signin")
  async signIn(
    @Body(new ZodPipe(signInRequest)) body: { email: string; password: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const outcome = await this.auth.signIn(body, meta(req));
    if (outcome.token) {
      reply.setCookie(
        SESSION_COOKIE,
        outcome.token,
        this.cookieOptions(AUTH_POLICY.sessionDays * 86_400),
      );
    }
    if (outcome.pending) {
      reply.setCookie(PENDING_COOKIE, outcome.pending, this.cookieOptions(300));
    }
    return outcome.result;
  }

  @Post("2fa")
  async twoFactor(
    @Body(new ZodPipe(totpCode)) body: { code: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.completePending(req, reply, body.code, false);
  }

  @Post("2fa/recovery")
  async recovery(
    @Body(new ZodPipe(recoveryCode)) body: { code: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.completePending(req, reply, body.code, true);
  }

  @Post("signout")
  @UseGuards(AuthGuard)
  async signOut(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (raw) await this.sessions.revokeByToken(raw);
    reply.clearCookie(SESSION_COOKIE, { domain: this.env.COOKIE_DOMAIN, path: "/" });
    return { status: "signed-out" };
  }

  @Post("password/reset")
  async requestReset(@Body(new ZodPipe(emailOnly)) body: { email: string }) {
    await this.auth.requestPasswordReset(body.email);
    // Always the same answer, so the response cannot be used to discover accounts.
    return { status: "sent" };
  }

  @Post("password/reset/confirm")
  async confirmReset(
    @Body(new ZodPipe(resetConfirm)) body: { token: string; password: string },
  ) {
    await this.auth.confirmPasswordReset(body.token, body.password);
    return { status: "reset" };
  }

  @Post("email/verify")
  async verifyEmail(@Body(new ZodPipe(resetConfirm.pick({ token: true }))) body: { token: string }) {
    await this.auth.verifyEmail(body.token);
    return { status: "verified" };
  }

  @Get("sessions")
  @UseGuards(AuthGuard)
  async listSessions(@CurrentSession() session: SessionContext) {
    return this.sessions.list(session.userId, session.sessionId);
  }

  private async completePending(
    req: FastifyRequest,
    reply: FastifyReply,
    code: string,
    isRecovery: boolean,
  ) {
    const pending = req.cookies?.[PENDING_COOKIE] ?? "";
    const issued = await this.auth.completeTotp(pending, code, meta(req), isRecovery);
    reply.clearCookie(PENDING_COOKIE, { domain: this.env.COOKIE_DOMAIN, path: "/" });
    reply.setCookie(
      SESSION_COOKIE,
      issued.token,
      this.cookieOptions(AUTH_POLICY.sessionDays * 86_400),
    );
    return { status: "authenticated" } satisfies SignInResult;
  }
}
