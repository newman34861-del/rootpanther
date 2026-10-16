import { z } from "zod";

/**
 * Every failure carries a correlation id. The error screens already print one as a
 * support reference, so the shape is fixed by what the frontend renders.
 */
export const apiErrorCode = z.enum([
  "unauthenticated",
  "forbidden",
  "not-found",
  "conflict",
  "validation",
  "plan-required",
  "rate-limited",
  "capacity",
  "upstream",
  "internal",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCode>;

export const apiError = z.object({
  code: apiErrorCode,
  message: z.string(),
  correlationId: z.string().regex(/^req_[a-f0-9]{6}$/),
  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof apiError>;

export const pageQuery = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(25),
});
export type PageQuery = z.infer<typeof pageQuery>;

export function paged<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    perPage: z.number().int().positive(),
  });
}

/** Mutations that provision or charge accept an idempotency key so a retry is safe. */
export const idempotencyKey = z.string().uuid();
