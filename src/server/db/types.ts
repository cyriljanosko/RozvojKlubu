import type { ObjectId } from "mongodb";

/**
 * Document types of the application's own collections (no ODM).
 * Every club-scoped document carries `clubId` = Sportnet appSpace (ADR 0003, ADR 0005).
 */

export type Gender = "M" | "F";

/** Age group code as used by Sportnet (e.g. "U09", "U19", "ADULTS"). */
export type AgeGroup = string;

/** Level of the competition organiser. */
export type CompetitionLevel = "SFZ" | "RFZ" | "ObFZ";

/** Collection `clubs` – one document per club, unique `clubId`. */
export interface ClubDoc {
  _id?: ObjectId;
  clubId: string;
  name: string;
  /** Union the club belongs to (e.g. "ObFZ Trebišov", "SFZ"). */
  union: string;
  /** Regional union (BFZ, ZsFZ, SsFZ, VsFZ). */
  region: string;
  /** Futbalnet profile slug. */
  slug: string;
  source: "snapshot";
  /** Date the source data was taken (YYYY-MM-DD). */
  dataAsOf: string;
  importedAt: Date;
}

export interface TeamSummary {
  name: string;
  gender: Gender;
  ageGroup: AgeGroup;
  /** null when the team plays no competition. */
  level: CompetitionLevel | null;
  competitions: string[];
  playerCount: number;
}

export interface PlayerCount {
  ageGroup: AgeGroup;
  gender: Gender;
  count: number;
}

/** Personal data – shown only to roles with access to the club. */
export interface CoachRecord {
  name: string;
  teams: string[];
  positions: string[];
  licences: string[];
  expiredLicences: string[];
}

/** Collection `club_seasons` – unique `{ clubId, season }`. */
export interface ClubSeasonDoc {
  _id?: ObjectId;
  clubId: string;
  /** "2026/2027" */
  season: string;
  teams: TeamSummary[];
  players: PlayerCount[];
  uniquePlayers: number;
  coaches: CoachRecord[];
  otherStaff: Record<string, number>;
  source: "snapshot";
  dataAsOf: string;
  importedAt: Date;
}

export const CLUB_ROLES = ["management", "coach", "mentor"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

/** Collection `club_memberships` – a person's role in a club for one season (ADR 0004). */
export interface ClubMembershipDoc {
  _id?: ObjectId;
  /** Better Auth user id. */
  userId: string;
  clubId: string;
  role: ClubRole;
  season: string;
  /** Optional narrowing for coaches (age groups). Empty = whole club. */
  ageGroups: AgeGroup[];
  createdBy: string;
  createdAt: Date;
}
