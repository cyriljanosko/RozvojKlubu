import type { ClubDoc, ClubMembershipDoc, ClubRole } from "@/server/db/types";
import type { SportnetMeAppspaces } from "@/server/integrations/sportnet/me";
import { currentSeason } from "@/server/services/season";

/**
 * Club roles from sportnet.online at sign-in (S2-b, ADR 0021 part 3, ADR 0024, ADR 0026).
 * Pure functions plus one orchestrating service; I/O is injected.
 */

/** CRM roles that make a person the club manager (ADR 0024). */
export const CLUB_MANAGER_CRM_ROLES: readonly string[] = ["admin", "matrikar", "manager"];

/**
 * App role given for the CRM role. Still the code "management" – the rename to "club_manager"
 * (ADR 0021) is a separate change (ADR 0026).
 */
export const SPORTNET_CLUB_MANAGER_ROLE: ClubRole = "management";

export const SPORTNET_REF_CRM = "appspace:CRM";

export interface SportnetManagedClub {
  clubId: string;
  name: string;
  validTo?: Date;
}

const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Clubs (Sportnet `type: club`) where the person has a club-manager role in CRM today. */
export function deriveManagedClubs(me: SportnetMeAppspaces, today: Date): SportnetManagedClub[] {
  const found = new Map<string, SportnetManagedClub>();
  for (const app of me.apps ?? []) {
    for (const a of app.appspaces ?? []) {
      if ((a.app_id ?? app.app_id) !== "CRM") continue;
      if (!a.role || !CLUB_MANAGER_CRM_ROLES.includes(a.role)) continue;
      // Unions (futbalsfz.sk, ObFZ), schools and other PPO types are not clubs.
      if (a.org_profile?.type !== "club") continue;
      const validTo = a.validTo ? new Date(a.validTo) : undefined;
      if (validTo && !Number.isNaN(validTo.getTime()) && dayStart(validTo) < dayStart(today)) {
        continue;
      }
      if (!a.app_space || found.has(a.app_space)) continue;
      found.set(a.app_space, {
        clubId: a.app_space,
        name: a.org_profile?.name?.trim() || a.app_space,
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo : undefined,
      });
    }
  }
  return [...found.values()];
}

type Membership = Omit<ClubMembershipDoc, "_id">;

/** Sportnet links for the season. A role the person already has from the app is not duplicated. */
export function planSportnetLinks(input: {
  userId: string;
  season: string;
  now: Date;
  clubs: readonly SportnetManagedClub[];
  appLinks: readonly Pick<ClubMembershipDoc, "clubId" | "role" | "season" | "source">[];
}): Membership[] {
  const taken = new Set(
    input.appLinks
      .filter((m) => m.season === input.season && m.source !== "sportnet")
      .map((m) => `${m.clubId}|${m.role}`),
  );
  return input.clubs
    .filter((c) => !taken.has(`${c.clubId}|${SPORTNET_CLUB_MANAGER_ROLE}`))
    .map((c) => ({
      userId: input.userId,
      clubId: c.clubId,
      role: SPORTNET_CLUB_MANAGER_ROLE,
      season: input.season,
      ageGroups: [],
      createdBy: "sportnet",
      createdAt: input.now,
      source: "sportnet" as const,
      sportnetRef: SPORTNET_REF_CRM,
      ...(c.validTo ? { validTo: c.validTo } : {}),
      syncedAt: input.now,
    }));
}

/** Minimal club record for a club that is not in the app yet (ADR 0026); S3 fills the rest. */
export function clubFromSportnet(club: SportnetManagedClub, now: Date): ClubDoc {
  return {
    clubId: club.clubId,
    name: club.name,
    union: "",
    region: "",
    slug: "",
    source: "sportnet",
    dataAsOf: now.toISOString().slice(0, 10),
    importedAt: now,
  };
}

export interface ClubRolesSyncDeps {
  fetchAppspaces: (accessToken: string) => Promise<SportnetMeAppspaces>;
  /** Inserts clubs whose clubId is not stored yet; existing clubs stay untouched. */
  insertMissingClubs: (clubs: ClubDoc[]) => Promise<number>;
  listUserLinks: (
    userId: string,
  ) => Promise<Pick<ClubMembershipDoc, "clubId" | "role" | "season" | "source">[]>;
  /** Replaces the user's `source: "sportnet"` links of the season with `links`. */
  replaceSportnetLinks: (userId: string, season: string, links: Membership[]) => Promise<void>;
  now?: () => Date;
}

export interface ClubRolesSyncResult {
  clubs: number;
  createdClubs: number;
  links: number;
}

/** Refreshes the user's Sportnet club roles. Throws on Sportnet errors; callers decide. */
export async function syncSportnetClubRoles(
  deps: ClubRolesSyncDeps,
  userId: string,
  accessToken: string,
): Promise<ClubRolesSyncResult> {
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  const clubs = deriveManagedClubs(await deps.fetchAppspaces(accessToken), now);
  const createdClubs = clubs.length
    ? await deps.insertMissingClubs(clubs.map((c) => clubFromSportnet(c, now)))
    : 0;
  const links = planSportnetLinks({
    userId,
    season,
    now,
    clubs,
    appLinks: await deps.listUserLinks(userId),
  });
  await deps.replaceSportnetLinks(userId, season, links);
  return { clubs: clubs.length, createdClubs, links: links.length };
}
