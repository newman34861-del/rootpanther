import "reflect-metadata";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Logger } from "pino";
import { AppModule } from "./app.module";
import { ENV, LOGGER } from "./config/config.module";
import type { Env } from "./config/env";
import { ApiExceptionFilter } from "./common/errors";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }),
    { bufferLogs: true },
  );

  const env = app.get<Env>(ENV);
  const logger = app.get<Logger>(LOGGER);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  // Only the two first-party origins may call the API with credentials.
  app.enableCors({
    origin: [env.APP_ORIGIN, env.PORTAL_ORIGIN],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  });

  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.enableShutdownHooks();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "api listening");
}

bootstrap().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
