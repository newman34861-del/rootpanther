import { Global, Inject, Injectable, Module } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { createDatabase, type Database } from "./client";

export const DB = Symbol("DB");
const CONNECTION = Symbol("CONNECTION");

type Connection = ReturnType<typeof createDatabase>;

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(CONNECTION) private readonly conn: Connection) {}
  async onApplicationShutdown() {
    await this.conn.client.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CONNECTION,
      inject: [ENV],
      useFactory: (env: Env): Connection =>
        createDatabase(env.DATABASE_URL, env.DATABASE_POOL_MAX),
    },
    {
      provide: DB,
      inject: [CONNECTION],
      useFactory: (conn: Connection): Database => conn.db,
    },
    PoolCloser,
  ],
  exports: [DB],
})
export class DbModule {}
