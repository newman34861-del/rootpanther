import { Global, Module } from "@nestjs/common";
import pino, { type Logger } from "pino";
import { loadEnv, type Env } from "./env";

export const ENV = Symbol("ENV");
export const LOGGER = Symbol("LOGGER");

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },
    {
      provide: LOGGER,
      inject: [ENV],
      useFactory: (env: Env): Logger =>
        pino({
          level: env.LOG_LEVEL,
          // Secrets and session material must never reach the log sink.
          redact: {
            paths: [
              "req.headers.cookie",
              "req.headers.authorization",
              "*.password",
              "*.passwordHash",
              "*.token",
              "*.secret",
            ],
            censor: "[redacted]",
          },
        }),
    },
  ],
  exports: [ENV, LOGGER],
})
export class ConfigModule {}
