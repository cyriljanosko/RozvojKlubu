import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth, magicLink } from "better-auth/plugins";

import { defaultMessages } from "@/i18n/config";
import { resolveAuthBaseURL } from "@/server/auth/base-url";
import { DEFAULT_ROLE, parseAdminEmails } from "@/server/auth/roles";
import { sportnetProvider } from "@/server/auth/sportnet";
import { getDbSync, getMongoClient } from "@/server/db/mongo";
import { getEnv } from "@/server/env";
import { sendTransactional } from "@/server/integrations/ecomail/client";
import { sendMagicLinkEmail } from "@/server/services/email.service";

function createAuth() {
  const env = getEnv();
  const isProduction = env.NODE_ENV === "production";
  if (isProduction && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  }
  const adminEmails = parseAdminEmails(env.INITIAL_ADMIN_EMAILS);

  const sportnetEnabled = Boolean(env.SPORTNET_OAUTH_CLIENT_ID && env.SPORTNET_OAUTH_CLIENT_SECRET);

  return betterAuth({
    appName: "Rozvoj klubu",
    baseURL: resolveAuthBaseURL(env),
    // Dev-only fallback secret; production requires BETTER_AUTH_SECRET (checked above).
    secret: env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me-0123456789",
    database: mongodbAdapter(getDbSync(), { client: getMongoClient() }),
    emailAndPassword: { enabled: false },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: DEFAULT_ROLE, input: false },
        sportnetId: { type: "string", required: false, input: false },
      },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["sportnet"] },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              role: adminEmails.has(user.email.toLowerCase()) ? "admin_sfz" : DEFAULT_ROLE,
            },
          }),
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(
            {
              copy: defaultMessages.email.magicLink,
              apiKey: env.ECOMAIL_API_KEY,
              fromEmail: env.EMAIL_FROM,
              fromName: env.EMAIL_FROM_NAME,
              isProduction,
              send: (key, message) => sendTransactional(key, message),
              log: (m) => console.info(m),
            },
            email,
            url,
          );
        },
      }),
      ...(sportnetEnabled
        ? [
            genericOAuth({
              config: [
                {
                  ...sportnetProvider({
                    authUrl: env.SPORTNET_AUTH_URL,
                    clientId: env.SPORTNET_OAUTH_CLIENT_ID!,
                    clientSecret: env.SPORTNET_OAUTH_CLIENT_SECRET!,
                  }),
                  mapProfileToUser: (profile) => ({
                    sportnetId: typeof profile.sub === "string" ? profile.sub : undefined,
                  }),
                },
              ],
            }),
          ]
        : []),
      nextCookies(), // must stay last
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { _auth?: Auth };

/** Lazily created so builds without env (CI) do not need a database. */
export function getAuth(): Auth {
  globalForAuth._auth ??= createAuth();
  return globalForAuth._auth;
}

export function isSportnetLoginEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.SPORTNET_OAUTH_CLIENT_ID && env.SPORTNET_OAUTH_CLIENT_SECRET);
}
