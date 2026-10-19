import { ApiError } from "@/server/api/errors";
import type { ClubMembershipDoc, ClubRole } from "@/server/db/types";
import type { CurrentUser } from "@/server/services/users.service";

/**
 * Who may see a club (ADR 0003, ADR 0004). Pure functions, no I/O.
 * - admin_sfz: every club, explicit list in queries.
 * - everyone else: only clubs with a membership in the given season.
 */
export type MembershipLike = Pick<ClubMembershipDoc, "clubId" | "role" | "season">;

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin_sfz";
}

export function clubRolesFor(
  memberships: readonly MembershipLike[],
  clubId: string,
  season: string,
): ClubRole[] {
  return [
    ...new Set(
      memberships.filter((m) => m.clubId === clubId && m.season === season).map((m) => m.role),
    ),
  ];
}

export function memberClubIds(memberships: readonly MembershipLike[], season: string): string[] {
  return [...new Set(memberships.filter((m) => m.season === season).map((m) => m.clubId))];
}

export function canViewClub(
  user: CurrentUser,
  memberships: readonly MembershipLike[],
  clubId: string,
  season: string,
): boolean {
  return isAdmin(user) || clubRolesFor(memberships, clubId, season).length > 0;
}

export function requireClubView(
  user: CurrentUser,
  memberships: readonly MembershipLike[],
  clubId: string,
  season: string,
): void {
  if (!canViewClub(user, memberships, clubId, season)) {
    throw new ApiError("FORBIDDEN", "No access to this club");
  }
}

export function requireAdmin(user: CurrentUser): void {
  if (!isAdmin(user)) throw new ApiError("FORBIDDEN", "Insufficient role");
}
