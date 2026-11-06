import type { ClubRole } from "@/server/db/types";

/**
 * Levels of the roles in a club (analysis 3.1, decision of Cyril 26. 10. 2026):
 * club_manager ⊃ coach = team_manager ⊃ member; player = member. The mentor is outside the club.
 * Pure – shared by services and navigation.
 */

/** Roles of people who belong to the club (not the federation mentor). */
export const CLUB_MEMBER_ROLES: readonly ClubRole[] = [
  "club_manager",
  "coach",
  "team_manager",
  "player",
  "member",
];

/** Level T: coach and team manager (the same rights for now). */
export const COACH_LEVEL_ROLES: readonly ClubRole[] = ["coach", "team_manager"];

export const hasAnyRole = (roles: readonly string[], wanted: readonly ClubRole[]) =>
  roles.some((role) => (wanted as readonly string[]).includes(role));

export const isClubManager = (roles: readonly string[]) => roles.includes("club_manager");

/** Coach or team manager. The club manager is checked separately (it has more rights). */
export const isCoachLevel = (roles: readonly string[]) => hasAnyRole(roles, COACH_LEVEL_ROLES);

/** Any role in the club itself (club manager, coach, team manager, player, member). */
export const isClubMember = (roles: readonly string[]) => hasAnyRole(roles, CLUB_MEMBER_ROLES);

/**
 * Base role of the role catalog (content, ADR 0010) for a club role. The catalog keeps the
 * base key "management" for the club manager (URLs and saved choices use it).
 */
export const BASE_ROLE_OF: Partial<Record<ClubRole, string>> = {
  club_manager: "management",
  coach: "coach",
  team_manager: "coach",
  mentor: "mentor",
};

/** Prax role (content) for a club role; players and members have none. */
export const PRACTICE_ROLE_OF: Partial<Record<ClubRole, string>> = {
  club_manager: "v",
  coach: "t",
  team_manager: "t",
  mentor: "m",
};
