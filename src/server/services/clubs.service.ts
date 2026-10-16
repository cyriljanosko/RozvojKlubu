import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import {
  CLUB_ROLES,
  type ClubDoc,
  type ClubMembershipDoc,
  type ClubRole,
  type ClubSeasonDoc,
  type TeamSummary,
} from "@/server/db/types";
import {
  clubRolesFor,
  isAdmin,
  memberClubIds,
  requireAdmin,
  requireClubView,
} from "@/server/services/club-access";
import { parseSnapshot, type SnapshotStore } from "@/server/services/club-snapshot.service";
import { currentSeason, isSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/** Data access the services need; Mongo implementations live in src/server/db. */
export interface ClubStore {
  /** `clubIds: "all"` is allowed only for admin_sfz callers (checked here, not in the store). */
  listClubs: (clubIds: readonly string[] | "all") => Promise<ClubDoc[]>;
  findClub: (clubId: string) => Promise<ClubDoc | null>;
  findSeason: (clubId: string, season: string) => Promise<ClubSeasonDoc | null>;
  listSeasonNames: (clubId: string) => Promise<string[]>;
}

export interface MembershipStore {
  listByUser: (userId: string) => Promise<StoredMembership[]>;
  listByClub: (clubId: string, season: string) => Promise<StoredMembership[]>;
  create: (doc: Omit<ClubMembershipDoc, "_id">) => Promise<StoredMembership>;
  /** Deletes only within the given club (tenant filter); returns false when not found. */
  delete: (clubId: string, membershipId: string) => Promise<boolean>;
}

export type StoredMembership = Omit<ClubMembershipDoc, "_id"> & { id: string };

export interface UserDirectory {
  findById: (id: string) => Promise<CurrentUser | null>;
  findByEmail: (email: string) => Promise<CurrentUser | null>;
}

export interface ClubDeps {
  clubs: ClubStore;
  memberships: MembershipStore;
  users: UserDirectory;
  now?: () => Date;
}

const seasonOf = (deps: ClubDeps) => currentSeason(deps.now?.() ?? new Date());

// ---- DTOs (API boundary: no ObjectId, no personal data of third persons) ----

export interface ClubListItem {
  clubId: string;
  name: string;
  union: string;
  region: string;
  roles: ClubRole[];
}

export interface ClubOverview {
  club: { clubId: string; name: string; union: string; region: string; slug: string };
  season: string;
  seasons: string[];
  dataAsOf: string | null;
  roles: ClubRole[];
  stats: {
    teams: number;
    teamsInCompetition: number;
    uniquePlayers: number;
    girls: number;
    coaches: number;
  } | null;
  teams: TeamSummary[];
}

const toListItem = (club: ClubDoc, roles: ClubRole[]): ClubListItem => ({
  clubId: club.clubId,
  name: club.name,
  union: club.union,
  region: club.region,
  roles,
});

/** Clubs the user may open: admin all, others their memberships in the current season. */
export async function listMyClubs(
  deps: ClubDeps,
  actor: CurrentUser | null,
): Promise<ClubListItem[]> {
  const user = requireUser(actor);
  const season = seasonOf(deps);
  const memberships = await deps.memberships.listByUser(user.id);
  const ids = memberClubIds(memberships, season);
  const clubs = await deps.clubs.listClubs(isAdmin(user) ? "all" : ids);
  return clubs
    .map((c) => toListItem(c, clubRolesFor(memberships, c.clubId, season)))
    .filter((c) => isAdmin(user) || c.roles.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "sk"));
}

export async function getClubOverview(
  deps: ClubDeps,
  actor: CurrentUser | null,
  clubId: string,
  requestedSeason?: string,
): Promise<ClubOverview> {
  const user = requireUser(actor);
  const season = seasonOf(deps);
  const memberships = await deps.memberships.listByUser(user.id);
  // Access is decided by the current season's membership; past data of the same club is visible too.
  requireClubView(user, memberships, clubId, season);

  const club = await deps.clubs.findClub(clubId);
  if (!club) throw new ApiError("NOT_FOUND", "Club not found");

  const seasons = (await deps.clubs.listSeasonNames(clubId)).sort().reverse();
  if (requestedSeason !== undefined && !isSeason(requestedSeason)) {
    throw new ApiError("BAD_REQUEST", "Invalid season");
  }
  const shown = requestedSeason ?? (seasons.includes(season) ? season : (seasons[0] ?? season));
  const data = await deps.clubs.findSeason(clubId, shown);

  return {
    club: {
      clubId: club.clubId,
      name: club.name,
      union: club.union,
      region: club.region,
      slug: club.slug,
    },
    season: shown,
    seasons,
    dataAsOf: data?.dataAsOf ?? null,
    roles: clubRolesFor(memberships, clubId, season),
    stats: data
      ? {
          teams: data.teams.length,
          teamsInCompetition: data.teams.filter((t) => t.level !== null).length,
          uniquePlayers: data.uniquePlayers,
          girls: data.players.filter((p) => p.gender === "F").reduce((s, p) => s + p.count, 0),
          coaches: data.coaches.length,
        }
      : null,
    teams: data?.teams ?? [],
  };
}

// ---- Club members (admin_sfz only in the pilot) ----

export interface ClubMember {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: ClubRole;
  season: string;
  ageGroups: string[];
}

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(CLUB_ROLES),
  season: z.string().refine(isSeason, "Invalid season").optional(),
  ageGroups: z
    .array(z.string().regex(/^(U\d{2}|ADULTS)$/))
    .max(20)
    .default([]),
});
export type AddMemberInput = z.input<typeof addMemberSchema>;

async function requireExistingClub(deps: ClubDeps, clubId: string): Promise<ClubDoc> {
  const club = await deps.clubs.findClub(clubId);
  if (!club) throw new ApiError("NOT_FOUND", "Club not found");
  return club;
}

export async function listClubMembers(
  deps: ClubDeps,
  actor: CurrentUser | null,
  clubId: string,
  season?: string,
): Promise<ClubMember[]> {
  const user = requireUser(actor);
  requireAdmin(user);
  await requireExistingClub(deps, clubId);
  const s = season ?? seasonOf(deps);
  if (!isSeason(s)) throw new ApiError("BAD_REQUEST", "Invalid season");
  const members = await deps.memberships.listByClub(clubId, s);
  const people = await Promise.all(members.map((m) => deps.users.findById(m.userId)));
  return members.map((m, i) => ({
    id: m.id,
    userId: m.userId,
    email: people[i]?.email ?? null,
    name: people[i]?.name ?? null,
    role: m.role,
    season: m.season,
    ageGroups: m.ageGroups,
  }));
}

export async function addClubMember(
  deps: ClubDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<ClubMember> {
  const user = requireUser(actor);
  requireAdmin(user);
  const data = addMemberSchema.parse(input);
  await requireExistingClub(deps, clubId);
  const season = data.season ?? seasonOf(deps);

  const person = await deps.users.findByEmail(data.email);
  // The person must have signed in at least once (no accounts are created on their behalf).
  if (!person) throw new ApiError("NOT_FOUND", "User not found");

  const existing = await deps.memberships.listByClub(clubId, season);
  if (existing.some((m) => m.userId === person.id && m.role === data.role)) {
    throw new ApiError("CONFLICT", "Membership already exists");
  }

  const created = await deps.memberships.create({
    userId: person.id,
    clubId,
    role: data.role,
    season,
    ageGroups: data.role === "coach" ? data.ageGroups : [],
    createdBy: user.id,
    createdAt: deps.now?.() ?? new Date(),
  });
  return {
    id: created.id,
    userId: person.id,
    email: person.email,
    name: person.name,
    role: created.role,
    season: created.season,
    ageGroups: created.ageGroups,
  };
}

export async function removeClubMember(
  deps: ClubDeps,
  actor: CurrentUser | null,
  clubId: string,
  membershipId: string,
): Promise<void> {
  const user = requireUser(actor);
  requireAdmin(user);
  const deleted = await deps.memberships.delete(clubId, membershipId);
  if (!deleted) throw new ApiError("NOT_FOUND", "Membership not found");
}

// ---- Snapshot import (admin_sfz) ----

export async function importClubSnapshot(
  store: SnapshotStore,
  actor: CurrentUser | null,
  raw: unknown,
  now: Date = new Date(),
): Promise<{ dataAsOf: string; clubs: number; seasons: number }> {
  const user = requireUser(actor);
  requireAdmin(user);
  const snapshot = parseSnapshot(raw, now);
  const counts = await store.saveSnapshot(snapshot);
  return { dataAsOf: snapshot.dataAsOf, ...counts };
}
