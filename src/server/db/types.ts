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
  entity: "area" | "kompas_question" | "area_section" | "area_practice" | "role_catalog";
  entityId: string;
  /** Version created by this change. */
  version: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  changedBy: string;
  changedAt: Date;
}

/** Collection `role_catalog` – one document (`key: "roles"`): base roles and roles in the 11 areas (ADR 0010). */
export interface RoleCatalogDoc {
  _id?: ObjectId;
  key: "roles";
  /** validated by roleCatalogSchema */
  content: Record<string, unknown>;
  version: number;
  updatedAt: Date;
  updatedBy: string;
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
  /** missing = "submitted"; "withdrawn" = cancelled by admin_sfz, kept as history (ADR 0009) */
  status?: "submitted" | "withdrawn";
  withdrawnAt?: Date;
  withdrawnBy?: string;
}

/** Club inputs of the licensing evaluation (areas 5–7, population, coach gender corrections). */
export interface LicensingInputs {
  population: number | null;
  infrastructure: Record<string, number>;
  activities: Record<string, number | boolean>;
  cooperation: Record<string, number | boolean>;
  /** corrections of the guessed coach gender, keyed by coach name */
  coachGender: Record<string, Gender>;
}

/** Collection `licensing_evaluations` – working version per club and season, unique `{ clubId, season }` (ADR 0006). */
export interface LicensingEvaluationDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  inputs: LicensingInputs;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

/** Collection `licensing_submissions` – closed (frozen) evaluations of a season; unique `{ clubId, season }`
 *  among valid closings only (`status: "closed"`), reopened ones stay as history (ADR 0008). */
export interface LicensingSubmissionDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  ruleSet: string;
  evaluationVersion: number;
  inputs: LicensingInputs;
  /** scored result at closing time (LicensingResult) */
  result: Record<string, unknown>;
  /** date of the Sportnet data the result was computed from */
  dataAsOf: string | null;
  closedAt: Date;
  closedBy: string;
  /** missing on closings made before ADR 0008 = "closed" */
  status?: "closed" | "reopened";
  reopenedAt?: Date;
  reopenedBy?: string;
}

/** Collection `area_role_choices` – the user's own roles in the areas for a club and season,
 *  unique `{ userId, clubId, season }` (F6b, ADR 0010). Roles as "area.key", e.g. "8.economist". */
export interface AreaRoleChoiceDoc {
  _id?: ObjectId;
  userId: string;
  clubId: string;
  season: string;
  roles: string[];
  updatedAt: Date;
}

/** Collection `practice_progress` – a club's progress in the Prax of an area per season (F6d, 17. 10. 2026). */
export interface PracticeProgressStep {
  stepId: string;
  /** index of the chosen option of the step, null when none chosen yet */
  option: number | null;
  done: boolean;
  doneAt: Date | null;
}

export interface PracticeProgressDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  area: number;
  /** ids of the first-step tasks that are done */
  tasks: string[];
  steps: PracticeProgressStep[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

/** Collection `mentor_visits` – a union mentor's visit to a club with agreed actions (21. 10. 2026). */
export type MentorVisitForm = "onsite" | "online" | "phone";
/** planned: date and topics known in advance, the club sees it and prepares (MC, 22. 10. 2026) */
export type MentorVisitStatus = "planned" | "draft" | "sent" | "withdrawn";

/** How an agreed step or a task before the visit turned out (mentor's rating, MC). */
export type MentorRating = "done" | "partial" | "not";

/**
 * Mentor's assessment of a visit, like the EYA coach mentoring (MC, decision 22. 10. 2026):
 * one block per topic of the visit (strengths, weaknesses, recommendations) – or one general
 * block (area null) when the visit has no topic – and one overall assessment of the meeting.
 */
export interface MentorTopicAssessment {
  /** the topic's area; null = the general block of a visit without a topic */
  area: number | null;
  strengths: string;
  weaknesses: string;
  recommendations: string;
}

export interface MentorAssessment {
  topics: MentorTopicAssessment[];
  overall: string;
}

export interface MentorVisitAction {
  id: string;
  text: string;
  /** area 1–11 the action belongs to, if any */
  area: number | null;
  /** who is responsible – a name or a role, free text (shown) */
  owner: string;
  /** the responsible club member, when picked from the club's people (sees the task) */
  ownerId: string | null;
  /** ISO date "YYYY-MM-DD" */
  dueDate: string | null;
  done: boolean;
  doneAt: Date | null;
  doneBy: string | null;
  /** mentor's rating at a later meeting (MC); null = not rated yet */
  rating: MentorRating | null;
}

/** A task the club prepares before the visit (MC). */
export interface MentorPrepTask {
  text: string;
  /** ISO date "YYYY-MM-DD" */
  dueDate: string | null;
  done: boolean;
  doneAt: Date | null;
  doneBy: string | null;
  rating: MentorRating | null;
}

export interface MentorVisitDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  form: MentorVisitForm;
  /** people with a role in the club who were present (user ids, decision 21. 10. 2026) */
  participantIds: string[];
  /** other people present – names, free text (visible to the club, its mentor and admin_sfz only) */
  participants: string;
  /** free summary – visits before 22. 10. 2026; new visits use `assessment` (MC) */
  summary: string;
  /** areas the visit is about, 0–3 (MC) */
  topics: number[];
  assessment: MentorAssessment | null;
  prepTask: MentorPrepTask | null;
  findings: { area: number; text: string }[];
  actions: MentorVisitAction[];
  status: MentorVisitStatus;
  sentAt: Date | null;
  withdrawnAt: Date | null;
  withdrawnBy: string | null;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

/** Collection `club_plans` – the club's plan for a season: goals per area (21. 10. 2026). */
export type PlanGoalStatus = "todo" | "doing" | "done";

export interface PlanGoal {
  id: string;
  area: number;
  /** the goal in one sentence (internal) */
  title: string;
  /** shown on the public Vizitka – no names, plain words for parents and the municipality */
  publicText: string;
  /** how the club will know the goal is met (optional) */
  indicator: string;
  owner: string;
  ownerId: string | null;
  /** ISO date "YYYY-MM-DD" */
  dueDate: string | null;
  status: PlanGoalStatus;
  doneAt: Date | null;
}

export interface ClubPlanDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  goals: PlanGoal[];
  /** confirmed by the club's mentor or admin_sfz (optional) */
  confirmedAt: Date | null;
  confirmedBy: string | null;
  /** last change of the goals' content (not of a status) – "edited after confirmation" */
  editedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

/** Collection `user_preferences` – a user's own dashboard and favourites (MD, 22. 10. 2026). */
export type FavoriteKind =
  "area" | "section" | "practice" | "pattern" | "vizitka" | "plan" | "visits";

export interface Favorite {
  id: string;
  kind: FavoriteKind;
  /** internal path of the pinned page (always starts with a single "/") */
  href: string;
  /** label as shown when pinned (area name, section title, club name …) */
  label: string;
  addedAt: Date;
}

export interface UserPreferencesDoc {
  _id?: ObjectId;
  /** Better Auth user id – one document per user, not club data (no clubId) */
  userId: string;
  /** Moja Akadémia tiles: order and hidden ones (tile ids) */
  dashboard: { order: string[]; hidden: string[] };
  favorites: Favorite[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection `club_mentoring` – the club's mentoring cycle of a season, like the EYA coach
 * mentoring (MC, 22. 10. 2026): the club's opening self-assessment, the mentor's development focus
 * and the closing of the season by the club and by the mentor. Visits stay in `mentor_visits`.
 */
export interface MentoringIntro {
  strengths: string;
  weaknesses: string;
  /** what the club wants to improve this season */
  improve: string;
  /** what the club expects from the mentor */
  expectations: string;
  savedAt: Date;
  savedBy: string;
}

export interface MentoringFocus {
  strengths: string;
  weaknesses: string;
  recommendations: string;
  /** the mentor's characterisation of the club */
  assessment: string;
  /** priority areas for the season, 1–3 */
  areas: number[];
  savedAt: Date;
  savedBy: string;
}

export interface MentoringClosingClub {
  /** how the club sees the agreed steps */
  stepsReview: string;
  /** remarks on the mentoring – only the mentor and admin_sfz (and its author) read it */
  feedback: string;
  selfAssessment: string;
  savedAt: Date;
  savedBy: string;
}

export interface MentoringClosingMentor {
  assessment: string;
  /** development plan for the next season */
  nextPlan: string;
  savedAt: Date;
  savedBy: string;
}

export interface ClubMentoringDoc {
  _id?: ObjectId;
  clubId: string;
  season: string;
  intro: MentoringIntro | null;
  focus: MentoringFocus | null;
  closingClub: MentoringClosingClub | null;
  closingMentor: MentoringClosingMentor | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}
