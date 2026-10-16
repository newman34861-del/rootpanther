import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

@Module({
  // AuthModule is imported for AuthGuard, which resolves the session cookie. The account
  // surface has no unauthenticated route.
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
