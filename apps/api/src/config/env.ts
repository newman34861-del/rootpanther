import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().url(),
  /** Pool size per instance. Container Apps scales instances, so keep this modest. */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),

  APP_ORIGIN: z.string().url(),
  PORTAL_ORIGIN: z.string().url(),
  /** Public origin of this API. Providers redirect back here, so it must match exactly. */
  API_ORIGIN: z.string().url(),
  /** Cookies are issued on the parent domain so app, portal and api share a session. */
  COOKIE_DOMAIN: z.string().min(1),
  SESSION_SECRET: z.string().min(32),

  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_MICROSOFT_CLIENT_ID: z.string().optional(),
  OAUTH_MICROSOFT_CLIENT_SECRET: z.string().optional(),
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ONYX_API_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${fields.join("\n  ")}`);
  }
  return parsed.data;
}
