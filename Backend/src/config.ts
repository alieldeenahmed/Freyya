import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  // Turn on behind a proxy or load balancer so rate limits see the real client address.
  TRUST_PROXY: z.stringbool().default(false),
  // Leave on outside tests. The end-to-end run turns it off so its own sign-ins are not throttled.
  RATE_LIMIT: z.stringbool().default(true),
  // At runtime this should be the pooled connection (Neon's "-pooler" host). Migrations and the
  // seed use DATABASE_URL_UNPOOLED when it is set, because they need a real session.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  // How many connections each running instance keeps. Several instances can run at once, so
  // this stays small.
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  // Comma-separated list of origins allowed to call the API from a browser.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Admin sign-in. Generate the hash with `npm run admin:hash`.
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_SESSION_HOURS: z.coerce.number().int().positive().default(12),
  // How long unpaid stock stays reserved before the order is cancelled.
  RESERVATION_MINUTES: z.coerce.number().int().positive().default(15),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().nonnegative().default(5),
  // Authenticates the scheduled jobs (/internal/*). Without it those routes stay switched off.
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
  // Shared with the storefront, which forwards the visitor's address in a header. The API only
  // believes that header when this secret comes with it, so no one else can pick their own address.
  PROXY_SECRET: z.string().min(16, "PROXY_SECRET must be at least 16 characters").optional(),
  // The public demo: lower caps against abuse, and the nightly reset becomes possible.
  DEMO_MODE: z.stringbool().default(false),
  // In demo mode, no more unpaid orders than this may exist at once, so the twelve items
  // cannot all be held in one burst.
  DEMO_MAX_PENDING_ORDERS: z.coerce.number().int().positive().default(8),
  // In demo mode, how many orders one address may place in an hour.
  DEMO_ORDERS_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(6),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return parsed.data;
}

export function corsOrigins(config: Config): string[] {
  return config.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
