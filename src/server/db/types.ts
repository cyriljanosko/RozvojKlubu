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

// ---- Managed content (global, no tenant – ADR 0003) ----

/** Age-group tags of Kompas questions; "rast" = always applies. */
export const QUESTION_TAGS = ["D", "Z", "DO", "S", "zd", "rast"] as const;
export type QuestionTag = (typeof QUESTION_TAGS)[number];

/** Kompas columns: i = implementation, s = social responsibility. */
export type QuestionColumn = "i" | "s";

interface Versioned {
  version: number;
  updatedAt: Date;
  /** Better Auth user id, or "seed" for the initial import. */
  updatedBy: string;
}

/** Collection `areas` – the 11 development areas, unique `number`. */
export interface AreaDoc extends Versioned {
  _id?: ObjectId;
  number: number;
  name: string;
  shortName: string;
  /** Colour band: 1 people & leadership, 2 players & growth, 3 club operations. */
  band: 1 | 2 | 3;
  description: string;
  /** Design artifacts the content was taken from. */
  sources: { overview: string; detail: string };
}

/** Collection `kompas_questions` – unique `questionId` ("4.i.2"). */
export interface KompasQuestionDoc extends Versioned {
  _id?: ObjectId;
  questionId: string;
  area: number;
  column: QuestionColumn;
  /** 1–10 within the column. */
  order: number;
  text: string;
  tags: QuestionTag[];
}

export type SectionKind = "methodology" | "practice";

/** Collection `area_sections` – Markdown sections of an area, unique `{ area, kind, key }`. */
export interface AreaSectionDoc extends Versioned {
  _id?: ObjectId;
  area: number;
  kind: SectionKind;
  /** Stable slug from the source (e.g. "implementacia"). */
  key: string;
  order: number;
  title: string;
  /** Markdown (GFM). */
  body: string;
  /** Date the facts are valid for (YYYY-MM-DD), for time-sensitive content (taxes, laws). */
  validAsOf: string | null;
  /** Date of the last content review (YYYY-MM-DD). */
  reviewedAt: string | null;
}

/** Collection `area_practice` – Practice of one area (all roles), unique `area`. Shape: practice.schema.ts */
export interface AreaPracticeDoc extends Versioned {
  _id?: ObjectId;
  area: number;
  /** Validated by practiceSchema (roles, templates, mentor modules). */
  content: Record<string, unknown>;
  validAsOf: string | null;
  reviewedAt: string | null;
}

/** Collection `content_revisions` – one document per change of managed content. */
export interface ContentRevisionDoc {
  _id?: ObjectId;
  entity: "area" | "kompas_question" | "area_section" | "area_practice";
  entityId: string;
  /** Version created by this change. */
  version: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  changedBy: string;
  changedAt: Date;
}

// ---- Kompas klubu (club data, tenant = clubId) ----

/** Collection `kompas_assessments` – a club's working self-assessment, unique `{ clubId, season }`. */
export interface KompasAssessmentDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  /** questionIds checked as "true for our club" */
  answers: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

/** Collection `kompas_submissions` – frozen copy sent to the mentor (decision 16. 10. 2026). */
export interface KompasSubmissionDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  /** assessment version that was submitted */
  assessmentVersion: number;
  answers: string[];
  categories: string[];
  /** question texts and tags as they were at submission time */
  questions: { questionId: string; text: string; tags: string[] }[];
  /** scored result at submission time (KompasResult) */
  result: Record<string, unknown>;
  /** SFZ-KOMPAS-1 transfer line */
  line: string;
  submittedAt: Date;
  submittedBy: string;
}
