import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";
import { SecurityController } from "./security.controller";
import { SecurityService } from "./security.service";

@Module({
  // AuthModule is imported for AuthGuard and the services the security surface acts on.
  // Nothing here has an unauthenticated route.
  imports: [AuthModule],
  controllers: [AccountController, SecurityController],
  providers: [AccountService, SecurityService],
  exports: [AccountService],
})
export class AccountModule {}
