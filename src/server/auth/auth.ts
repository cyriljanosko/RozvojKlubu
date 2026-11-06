import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth, magicLink } from "better-auth/plugins";

import { defaultMessages } from "@/i18n/config";
import { resolveAuthBaseURL } from "@/server/auth/base-url";
import { bootstrapRole, DEFAULT_ROLE, parseAdminEmails } from "@/server/auth/roles";
import {
  isSportnetConfigured,
  sportnetIdFromAccount,
  sportnetProvider,
} from "@/server/auth/sportnet";
import { mongoClubRolesSyncStore } from "@/server/db/clubs.store";
import { getDbSync, getMongoClient } from "@/server/db/mongo";
import { getEnv } from "@/server/env";
import { sendTransactional } from "@/server/integrations/ecomail/client";
import { fetchMyAffiliations, fetchMyAppspaces } from "@/server/integrations/sportnet/me";
import { syncSportnetClubRoles } from "@/server/services/club-roles-sync.service";
import { sendMagicLinkEmail } from "@/server/services/email.service";

function createAuth() {
  const env = getEnv();
  const isProduction = env.NODE_ENV === "production";
  if (isProduction && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  }
  const adminEmails = parseAdminEmails(env.INITIAL_ADMIN_EMAILS);

  const sportnetEnabled = isSportnetConfigured(env);

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
      account: {
        create: { after: linkSportnetId },
        update: { after: linkSportnetId },
      },
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
      session: {
        create: {
          // Accounts created before their e-mail was listed get admin_sfz on the next sign-in.
          after: async (session, ctx) => {
            if (adminEmails.size === 0 || !ctx) return;
            const adapter = ctx.context.internalAdapter;
            const user = await adapter.findUserById(session.userId);
            const role =
              user && bootstrapRole(user.email, (user as { role?: unknown }).role, adminEmails);
            if (role) await adapter.updateUser(session.userId, { role });
          },
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

/**
 * After every Sportnet sign-in (account create/update): stores the Sportnet id on the user so the
 * account page shows the link (see sportnetIdFromAccount), then refreshes club roles from
 * sportnet.online (S2-b). A failing sync never blocks the sign-in.
 */
async function linkSportnetId(
  account: { providerId?: unknown; accountId?: unknown; userId?: unknown; accessToken?: unknown },
  ctx: {
    context: { internalAdapter: { updateUser: (id: string, data: object) => Promise<unknown> } };
  } | null,
) {
  const sportnetId = sportnetIdFromAccount(account);
  if (!sportnetId || !ctx || typeof account.userId !== "string") return;
  await ctx.context.internalAdapter.updateUser(account.userId, { sportnetId });
  if (typeof account.accessToken === "string" && account.accessToken) {
    await syncClubRolesSafely(account.userId, account.accessToken);
  }
}

async function syncClubRolesSafely(userId: string, accessToken: string) {
  try {
    const result = await syncSportnetClubRoles(
      {
        ...mongoClubRolesSyncStore,
        fetchAppspaces: (token) => fetchMyAppspaces(token),
        fetchAffiliations: (token) => fetchMyAffiliations(token),
      },
      userId,
      accessToken,
    );
    console.info(
      `[sportnet] club roles synced – clubs ${result.clubs}, new clubs ${result.createdClubs}, links ${result.links}`,
    );
  } catch (error) {
    // Only the reason: no tokens or personal data in logs. Roles stay as they were.
    const reason = error instanceof Error ? error.message : "unknown";
    console.error(`[sportnet] club role sync failed – ${reason}`);
  }
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { _auth?: Auth };

/** Lazily created so builds without env (CI) do not need a database. */
export function getAuth(): Auth {
  globalForAuth._auth ??= createAuth();
  return globalForAuth._auth;
}

export function isSportnetLoginEnabled(): boolean {
  return isSportnetConfigured(getEnv());
}
