import { Body, Controller, Get, Put, Patch, Query, UseGuards } from "@nestjs/common";
import {
  labDefaultsUpdate,
  preferencesUpdate,
  profileUpdate,
  type LabDefaults,
  type Preferences,
  type ProfileUpdate,
} from "@rootpanther/contracts";
import { ZodPipe } from "../../common/zod.pipe";
import { AuthGuard, CurrentSession } from "../auth/auth.guard";
import type { SessionContext } from "../auth/session.service";
import { AccountService } from "./account.service";

@Controller("account")
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get("profile")
  async profile(@CurrentSession() session: SessionContext) {
    return this.account.profile(session.userId);
  }

  @Patch("profile")
  async updateProfile(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(profileUpdate.partial({ name: true }))) body: Partial<ProfileUpdate>,
  ) {
    return this.account.updateProfile(session.userId, body as ProfileUpdate);
  }

  @Get("handle")
  async handle(@CurrentSession() session: SessionContext, @Query("value") value: string) {
    return this.account.handleAvailability(session.userId, value ?? "");
  }

  @Get("preferences")
  async preferences(@CurrentSession() session: SessionContext) {
    return this.account.preferences(session.userId);
  }

  @Put("preferences")
  async savePreferences(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(preferencesUpdate)) body: Preferences,
  ) {
    return this.account.savePreferences(session.userId, body);
  }

  @Get("lab-defaults")
  async labDefaults(@CurrentSession() session: SessionContext) {
    return this.account.labDefaults(session.userId);
  }

  @Put("lab-defaults")
  async saveLabDefaults(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(labDefaultsUpdate)) body: LabDefaults,
  ) {
    return this.account.saveLabDefaults(session.userId, body);
  }

  @Get("footprint")
  async footprint(@CurrentSession() session: SessionContext) {
    return this.account.footprint(session.userId);
  }
}
