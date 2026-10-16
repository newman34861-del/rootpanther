import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { catalogueQuery, type CatalogueQuery } from "@rootpanther/contracts";
import { ApiException } from "../../common/errors";
import { AuthGuard, CurrentSession } from "../auth/auth.guard";
import type { SessionContext } from "../auth/session.service";
import { CatalogueService } from "./catalogue.service";

/**
 * Repeated query parameters arrive as an array and a single one as a string, so every
 * filter is normalised to an array before it is parsed. Without this, ticking one tier
 * and ticking two behave differently.
 */
function list(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

@Controller("catalogue")
@UseGuards(AuthGuard)
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  async list(@CurrentSession() session: SessionContext, @Query() raw: Record<string, unknown>) {
    const parsed = catalogueQuery.safeParse({
      q: raw.q,
      type: list(raw.type),
      tier: list(raw.tier),
      technique: list(raw.technique),
      os: list(raw.os),
      status: list(raw.status),
      duration: list(raw.duration),
      hosts: list(raw.hosts),
      sort: raw.sort ?? undefined,
      page: raw.page === undefined ? undefined : Number(raw.page),
      perPage: raw.perPage === undefined ? undefined : Number(raw.perPage),
    });
    if (!parsed.success) {
      throw new ApiException(
        "validation",
        "That filter is not one we offer.",
        Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message] as const),
        ),
      );
    }
    return this.catalogue.list(session.orgId, session.userId, parsed.data as CatalogueQuery);
  }

  @Get(":slug")
  async detail(@CurrentSession() session: SessionContext, @Param("slug") slug: string) {
    return this.catalogue.detail(session.orgId, session.userId, slug);
  }
}
