import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  // Turn on behind a proxy or load balancer so rate limits see the real client address.
  TRUST_PROXY: z.stringbool().default(false),
  // Leave on outside tests. The end-to-end run turns it off so its own sign-ins are not throttled.
  RATE_LIMIT: z.stringbool().default(true),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Comma-separated list of origins allowed to call the API from a browser.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Admin sign-in. Generate the hash with `npm run admin:hash`.
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_SESSION_HOURS: z.coerce.number().int().positive().default(12),
  // How long unpaid stock stays reserved before the order is cancelled.
  RESERVATION_MINUTES: z.coerce.number().int().positive().default(15),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().nonnegative().default(5),
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
