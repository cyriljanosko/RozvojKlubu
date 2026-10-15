import "server-only";

import { ApiError } from "@/server/api/errors";
import { getAuth } from "@/server/auth/auth";
import { isDatabaseConfigured } from "@/server/db/mongo";
import type { Role } from "@/server/auth/roles";
import { toPublicUser, type CurrentUser, type UserStore } from "@/server/services/users.service";

/** Resolves the signed-in user from request headers (cookie or bearer), or null. */
export async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
  if (!isDatabaseConfigured()) {
    throw new ApiError("SERVICE_UNAVAILABLE", "Database is not configured");
  }
  const session = await getAuth().api.getSession({ headers });
  return session ? toPublicUser(session.user) : null;
}

/** UserStore backed by Better Auth's internal adapter (no direct schema access). */
export const betterAuthUserStore: UserStore = {
  async findById(id) {
    const ctx = await getAuth().$context;
    const user = await ctx.internalAdapter.findUserById(id);
    return user ? toPublicUser(user) : null;
  },
  async updateRole(id, role: Role) {
    const ctx = await getAuth().$context;
    const user = await ctx.internalAdapter.updateUser(id, { role });
    return toPublicUser(user);
  },
};
