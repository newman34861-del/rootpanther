import { randomBytes } from "node:crypto";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { ApiError, ApiErrorCode } from "@rootpanther/contracts";
import type { FastifyReply } from "fastify";
import type { Logger } from "pino";

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  "not-found": 404,
  conflict: 409,
  validation: 422,
  "plan-required": 402,
  "rate-limited": 429,
  capacity: 503,
  upstream: 502,
  internal: 500,
};

export class ApiException extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function correlationId(): string {
  return `req_${randomBytes(3).toString("hex")}`;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const id = correlationId();

    let code: ApiErrorCode = "internal";
    let message = "Something went wrong on our side.";
    let fields: Record<string, string> | undefined;

    if (exception instanceof ApiException) {
      code = exception.code;
      message = exception.message;
      fields = exception.fields;
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const match = (Object.keys(STATUS) as ApiErrorCode[]).find((k) => STATUS[k] === status);
      code = match ?? "internal";
      message = exception.message;
    }

    // An unexpected failure is logged with its stack and correlation id so the reference
    // the learner reads back to support leads straight to the entry.
    if (code === "internal") {
      this.logger.error({ err: exception, correlationId: id }, "unhandled error");
    } else {
      this.logger.warn({ code, correlationId: id, message }, "request failed");
    }

    const body: ApiError = { code, message, correlationId: id, ...(fields ? { fields } : {}) };
    void reply.status(STATUS[code]).send(body);
  }
}
