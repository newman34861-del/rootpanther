import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB } from "../../db/db.module";
import type { Database } from "../../db/client";

@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Liveness. Answers as long as the process is up, so a slow database cannot cause a restart loop. */
  @Get()
  live() {
    return { status: "ok" };
  }

  /** Readiness. Reports the database so a failing instance is taken out of rotation. */
  @Get("ready")
  async ready() {
    const started = Date.now();
    await this.db.execute(sql`select 1`);
    return { status: "ok", database: { ok: true, ms: Date.now() - started } };
  }
}
