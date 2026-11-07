import type { ClubDoc, ClubMembershipDoc, ClubRole } from "@/server/db/types";
import type { SportnetAffiliation, SportnetMeAppspaces } from "@/server/integrations/sportnet/me";
import { recordAudit, type AuditDeps } from "@/server/services/audit.service";
import { currentSeason } from "@/server/services/season";

/**
 * Club roles from sportnet.online at sign-in (S2-b, ADR 0021 part 3, ADR 0024, ADR 0026).
 * Pure functions plus one orchestrating service; I/O is injected.
 */

/** CRM roles that make a person the club manager (ADR 0024). */
export const CLUB_MANAGER_CRM_ROLES: readonly string[] = ["admin", "matrikar", "manager"];

/** App role given for the CRM role (ADR 0021: renamed from `management`). */
export const SPORTNET_CLUB_MANAGER_ROLE: ClubRole = "club_manager";

export const SPORTNET_REF_CRM = "appspace:CRM";

export interface SportnetManagedClub {
  clubId: string;
  name: string;
  validTo?: Date;
}

/** A role from Sportnet in a club (club manager from CRM or a role from an affiliation). */
export interface SportnetClubRole {
  clubId: string;
  role: ClubRole;
  sportnetRef: string;
  validTo?: Date;
}

const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const parseDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Clubs (Sportnet `type: club`) where the person has a club-manager role in CRM today. */
export function deriveManagedClubs(me: SportnetMeAppspaces, today: Date): SportnetManagedClub[] {
  const found = new Map<string, SportnetManagedClub>();
  for (const app of me.apps ?? []) {
    for (const a of app.appspaces ?? []) {
      if ((a.app_id ?? app.app_id) !== "CRM") continue;
      if (!a.role || !CLUB_MANAGER_CRM_ROLES.includes(a.role)) continue;
      // Unions (futbalsfz.sk, ObFZ), schools and other PPO types are not clubs.
      if (a.org_profile?.type !== "club") continue;
      const validTo = parseDate(a.validTo);
      if (validTo && dayStart(validTo) < dayStart(today)) continue;
      if (!a.app_space || found.has(a.app_space)) continue;
      found.set(a.app_space, {
        clubId: a.app_space,
        name: a.org_profile?.name?.trim() || a.app_space,
        validTo,
      });
    }
  }
  return [...found.values()];
}

/** `competence_type` compared as ISSF writes it or as a code (ADR 0021, B2): lowercase, no diacritics. */
export function normalizeCompetence(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Vedúci družstva" and "Vedúci družstva / Tímový manažér" (B6). */
const TEAM_MANAGER_PREFIX = "veduci druzstva";

/** Active per CoreApi `isActive` (B5); without it date_from ≤ today ≤ date_to (ADR 0021). */
export function isAffiliationActive(a: SportnetAffiliation, today: Date): boolean {
  if (typeof a.isActive === "boolean") return a.isActive;
  const from = parseDate(a.date_from);
  const to = parseDate(a.date_to);
  if (from && dayStart(from) > dayStart(today)) return false;
  return !(to && dayStart(to) < dayStart(today));
}

/** Strength in the club (analysis 3.1): club_manager ⊃ team_manager ⊃ member; player = member. */
const STRENGTH: Partial<Record<ClubRole, number>> = {
  club_manager: 3,
  team_manager: 2,
  player: 1,
  member: 0,
};

/**
 * Roles from `/me/sport-orgs` and `/me/sport-expert-orgs` (ADR 0021): player, team manager and
 * member, only in clubs the app knows (clubs are created only from the club-manager role, ADR 0026).
 * Coach stays manual (B1).
 */
export function deriveAffiliationRoles(
  input: {
    sportOrgs: readonly SportnetAffiliation[];
    sportExpertOrgs: readonly SportnetAffiliation[];
  },
  today: Date,
  knownClubIds: ReadonlySet<string>,
): SportnetClubRole[] {
  const roles: SportnetClubRole[] = [];
  const add = (a: SportnetAffiliation, role: ClubRole, kind: string) => {
    const clubId = a.org_profile_id;
    if (!clubId || !knownClubIds.has(clubId) || !isAffiliationActive(a, today)) return;
    const validTo = parseDate(a.date_to);
    roles.push({
      clubId,
      role,
      sportnetRef: `${kind}:${a._id ?? clubId}`,
      ...(validTo ? { validTo } : {}),
    });
  };
  for (const a of input.sportOrgs) {
    if (normalizeCompetence(a.competence_type) === "player") add(a, "player", "sport_orgs");
  }
  for (const a of input.sportExpertOrgs) {
    const teamManager = normalizeCompetence(a.competence_type).startsWith(TEAM_MANAGER_PREFIX);
    add(a, teamManager ? "team_manager" : "member", "sport_expert_orgs");
  }
  return roles;
}

/** One role per club: the strongest one (a weaker role adds no access). */
export function strongestPerClub(roles: readonly SportnetClubRole[]): SportnetClubRole[] {
  const best = new Map<string, SportnetClubRole>();
  for (const r of roles) {
    const current = best.get(r.clubId);
    if (!current || (STRENGTH[r.role] ?? -1) > (STRENGTH[current.role] ?? -1))
      best.set(r.clubId, r);
  }
  return [...best.values()];
}

type Membership = Omit<ClubMembershipDoc, "_id">;

/** Sportnet links for the season. A role the person already has from the app is not duplicated. */
export function planSportnetLinks(input: {
  userId: string;
  season: string;
  now: Date;
  roles: readonly SportnetClubRole[];
  appLinks: readonly Pick<ClubMembershipDoc, "clubId" | "role" | "season" | "source">[];
}): Membership[] {
  const taken = new Set(
    input.appLinks
      .filter((m) => m.season === input.season && m.source !== "sportnet")
      .map((m) => `${m.clubId}|${m.role}`),
  );
  return input.roles
    .filter((r) => !taken.has(`${r.clubId}|${r.role}`))
    .map((r) => ({
      userId: input.userId,
      clubId: r.clubId,
      role: r.role,
      season: input.season,
      ageGroups: [],
      createdBy: "sportnet",
      createdAt: input.now,
      source: "sportnet" as const,
      sportnetRef: r.sportnetRef,
      ...(r.validTo ? { validTo: r.validTo } : {}),
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

export interface ClubRolesSyncDeps extends AuditDeps {
  fetchAppspaces: (accessToken: string) => Promise<SportnetMeAppspaces>;
  fetchAffiliations: (accessToken: string) => Promise<{
    sportOrgs: SportnetAffiliation[];
    sportExpertOrgs: SportnetAffiliation[];
  }>;
  /** The subset of `clubIds` stored in the app. */
  listKnownClubIds: (clubIds: string[]) => Promise<string[]>;
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
/** Pure: per club, the user's Sportnet roles before and after the sync – only clubs that changed. */
export function sportnetRoleChanges(
  before: Pick<Membership, "clubId" | "role">[],
  after: Pick<Membership, "clubId" | "role">[],
): { clubId: string; from: string[]; to: string[] }[] {
  const rolesIn = (links: Pick<Membership, "clubId" | "role">[], clubId: string) =>
    [...new Set(links.filter((l) => l.clubId === clubId).map((l) => l.role))].sort();
  const clubIds = [...new Set([...before, ...after].map((l) => l.clubId))].sort();
  return clubIds
    .map((clubId) => ({ clubId, from: rolesIn(before, clubId), to: rolesIn(after, clubId) }))
    .filter((c) => c.from.join() !== c.to.join());
}

export async function syncSportnetClubRoles(
  deps: ClubRolesSyncDeps,
  userId: string,
  accessToken: string,
): Promise<ClubRolesSyncResult> {
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  // Both reads first: a Sportnet error leaves the stored roles as they were.
  const clubs = deriveManagedClubs(await deps.fetchAppspaces(accessToken), now);
  const affiliations = await deps.fetchAffiliations(accessToken);
  const createdClubs = clubs.length
    ? await deps.insertMissingClubs(clubs.map((c) => clubFromSportnet(c, now)))
    : 0;
  const affiliationClubIds = [
    ...new Set(
      [...affiliations.sportOrgs, ...affiliations.sportExpertOrgs]
        .map((a) => a.org_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const known = new Set(
    affiliationClubIds.length ? await deps.listKnownClubIds(affiliationClubIds) : [],
  );
  const roles = strongestPerClub([
    ...clubs.map((c) => ({
      clubId: c.clubId,
      role: SPORTNET_CLUB_MANAGER_ROLE,
      sportnetRef: SPORTNET_REF_CRM,
      ...(c.validTo ? { validTo: c.validTo } : {}),
    })),
    ...deriveAffiliationRoles(affiliations, now, known),
  ]);
  const appLinks = await deps.listUserLinks(userId);
  const links = planSportnetLinks({ userId, season, now, roles, appLinks });
  await deps.replaceSportnetLinks(userId, season, links);
  const before = appLinks.filter((l) => l.source === "sportnet" && l.season === season);
  for (const change of sportnetRoleChanges(before, links)) {
    await recordAudit(
      deps,
      { id: userId },
      {
        action: "club.member.sportnet",
        source: "sportnet",
        clubId: change.clubId,
        target: { type: "user", id: userId },
        changes: { roles: { from: change.from, to: change.to } },
        at: now,
      },
    );
  }
  return { clubs: clubs.length, createdClubs, links: links.length };
}
