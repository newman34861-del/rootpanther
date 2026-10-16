import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  changePassword,
  disableTotpRequest,
  oauthProvider,
  totpCode,
  type ChangePassword,
  type DisableTotpRequest,
  type OauthProvider,
  type TotpCode,
} from "@rootpanther/contracts";
import { ZodPipe } from "../../common/zod.pipe";
import { OauthService } from "../auth/oauth/oauth.service";
import { AuthGuard, CurrentSession } from "../auth/auth.guard";
import type { SessionContext } from "../auth/session.service";
import { SecurityService } from "./security.service";

@Controller("account/security")
@UseGuards(AuthGuard)
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly oauth: OauthService,
  ) {}

  @Get()
  async state(@CurrentSession() session: SessionContext) {
    return this.security.state(session.userId, session.sessionId);
  }

  @Post("password")
  async changePassword(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(changePassword)) body: ChangePassword,
  ) {
    await this.security.changePassword(session.userId, session.sessionId, body);
    return { status: "changed" };
  }

  @Delete("sessions/:id")
  async revokeSession(@CurrentSession() session: SessionContext, @Param("id") id: string) {
    await this.security.revokeSession(session.userId, id);
    return { status: "revoked" };
  }

  @Post("sessions/revoke-others")
  async revokeOthers(@CurrentSession() session: SessionContext) {
    await this.security.revokeOtherSessions(session.userId, session.sessionId);
    return { status: "revoked" };
  }

  @Post("2fa")
  async beginTotp(@CurrentSession() session: SessionContext) {
    return this.security.beginTotp(session.userId);
  }

  @Post("2fa/confirm")
  async confirmTotp(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(totpCode)) body: TotpCode,
  ) {
    return { codes: await this.security.confirmTotp(session.userId, body.code) };
  }

  @Delete("2fa")
  async disableTotp(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(disableTotpRequest)) body: DisableTotpRequest,
  ) {
    await this.security.disableTotp(session.userId, body.currentPassword);
    return { status: "disabled" };
  }

  @Post("2fa/recovery-codes")
  async regenerate(@CurrentSession() session: SessionContext) {
    return { codes: await this.security.regenerateRecoveryCodes(session.userId) };
  }

  @Delete("providers/:provider")
  async unlink(@CurrentSession() session: SessionContext, @Param("provider") provider: string) {
    const parsed = oauthProvider.parse(provider) as OauthProvider;
    await this.oauth.unlink(session.userId, parsed);
    return { status: "unlinked" };
  }
}
