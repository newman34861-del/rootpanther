import { Module } from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { LockoutService } from "./lockout.service";
import { OauthController } from "./oauth/oauth.controller";
import { OauthService } from "./oauth/oauth.service";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";
import { TotpService } from "./totp.service";

@Module({
  controllers: [AuthController, OauthController],
  providers: [
    AuthService,
    AuthGuard,
    EmailService,
    LockoutService,
    OauthService,
    PasswordService,
    SessionService,
    TotpService,
  ],
  exports: [AuthGuard, SessionService, PasswordService, TotpService, OauthService],
})
export class AuthModule {}
