import { ApiError } from "@/server/api/errors";
import { hasAnyRole, isRole, toRole, type Role } from "@/server/auth/roles";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: Role;
  sportnetId?: string | null;
}

/** Shape returned by API (never leaks internal fields). */
export function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role?: unknown;
  sportnetId?: unknown;
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? null,
    role: toRole(user.role),
    sportnetId: typeof user.sportnetId === "string" ? user.sportnetId : null,
  };
}

export function requireUser(user: CurrentUser | null): CurrentUser {
  if (!user) throw new ApiError("UNAUTHORIZED", "Authentication required");
  return user;
}

export function requireRole(user: CurrentUser | null, allowed: readonly Role[]): CurrentUser {
  const current = requireUser(user);
  if (!hasAnyRole(current.role, allowed)) {
    throw new ApiError("FORBIDDEN", "Insufficient role");
  }
  return current;
}

export interface UserStore {
  findById: (id: string) => Promise<CurrentUser | null>;
  updateRole: (id: string, role: Role) => Promise<CurrentUser>;
}

/** Only admin_sfz may change roles; an admin cannot demote themselves (lock-out guard). */
export async function changeUserRole(
  store: UserStore,
  actor: CurrentUser | null,
  targetId: string,
  newRole: unknown,
): Promise<CurrentUser> {
  const admin = requireRole(actor, ["admin_sfz"]);
  if (!isRole(newRole)) {
    throw new ApiError("BAD_REQUEST", "Unknown role");
  }
  if (admin.id === targetId && newRole !== "admin_sfz") {
    throw new ApiError("CONFLICT", "Admins cannot remove their own admin role");
  }
  const target = await store.findById(targetId);
  if (!target) throw new ApiError("NOT_FOUND", "User not found");
  return store.updateRole(targetId, newRole);
}
