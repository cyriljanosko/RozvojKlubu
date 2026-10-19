import "server-only";

import { z } from "zod";

/** Treat empty strings (e.g. `KEY=` in .env files) as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

/**
 * Server-side environment variables, validated on first access.
 * Never import this module from client components.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  MONGODB_URI: optional(z.string().min(1)),
  MONGODB_DB: z.string().min(1).default("rozvojklubu"),
  SPORTNET_API_URL: optional(z.url()),
  SPORTNET_API_KEY: optional(z.string().min(1)),

  // Authentication (Better Auth)
  BETTER_AUTH_SECRET: optional(z.string().min(32)),
  BETTER_AUTH_URL: optional(z.url()),
  /** Comma-separated e-mails that receive the admin_sfz role on first sign-in. */
  INITIAL_ADMIN_EMAILS: optional(z.string()),

  // Set by Vercel at runtime (hostnames without protocol)
  VERCEL_ENV: optional(z.enum(["development", "preview", "production"])),
  VERCEL_URL: optional(z.string().min(1)),
  VERCEL_BRANCH_URL: optional(z.string().min(1)),

  // Sportnet OIDC (auth.sportnet.online)
  SPORTNET_AUTH_URL: z.url().default("https://auth.sportnet.online"),
  SPORTNET_OAUTH_CLIENT_ID: optional(z.string().min(1)),
  SPORTNET_OAUTH_CLIENT_SECRET: optional(z.string().min(1)),

  // E-mail (Ecomail transactional API)
  ECOMAIL_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.email()),
  EMAIL_FROM_NAME: z.string().min(1).default("Rozvoj klubu SFZ"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
