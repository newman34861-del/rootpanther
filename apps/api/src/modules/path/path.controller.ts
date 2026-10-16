import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { declareTier, type DeclareTier } from "@rootpanther/contracts";
import { ZodPipe } from "../../common/zod.pipe";
import { AuthGuard, CurrentSession } from "../auth/auth.guard";
import type { SessionContext } from "../auth/session.service";
import { PathService } from "./path.service";

@Controller("path")
@UseGuards(AuthGuard)
export class PathController {
  constructor(private readonly path: PathService) {}

  @Get()
  async summary(@CurrentSession() session: SessionContext) {
    return this.path.summary(session.orgId, session.userId);
  }

  @Put("tier")
  async declare(
    @CurrentSession() session: SessionContext,
    @Body(new ZodPipe(declareTier)) body: DeclareTier,
  ) {
    return this.path.declare(session.orgId, session.userId, body.tier);
  }
}
