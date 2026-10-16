import type { PipeTransform } from "@nestjs/common";
import type { ZodTypeAny, z } from "zod";
import { ApiException } from "./errors";

/**
 * Validates a payload against the shared contract. The same schema the frontend compiles
 * against is the one that runs here, so a request the UI considers valid cannot be
 * rejected for a shape reason, and anything else is rejected before it reaches a service.
 */
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const parsed = this.schema.safeParse(value);
    if (parsed.success) return parsed.data;

    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "body";
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new ApiException("validation", "Check the highlighted fields.", fields);
  }
}
