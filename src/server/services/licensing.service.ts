import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type {
  ClubSeasonDoc,
  LicensingEvaluationDoc,
  LicensingInputs,
  LicensingSubmissionDoc,
} from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import {
  ACTIVITY_ITEMS,
  ACTIVITY_RECORDS,
  COOPERATION_ITEMS,
  COOPERATION_RECORDS,
  INFRASTRUCTURE_ITEMS,
  LICENSING_RULE_SET,
  type ScoredItem,
} from "@/server/services/licensing-rules";
import {
  EMPTY_INPUTS,
  scoreLicensing,
  type LicensingResult,
} from "@/server/services/licensing-scoring";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Licensing evaluation of a club per season (ADR 0006).
 * - management and the club's mentor (also on a club visit) edit and close; coaches read; admin_sfz edits;
 * - areas 2–4 are computed live from the Sportnet snapshot, areas 5–7 from the club's inputs;
 * - closing a season stores a frozen copy and locks that season.
 * Every query is scoped by clubId (ADR 0003).
 */
export interface EvaluationStore {
  findEvaluation: (clubId: string, season: string) => Promise<LicensingEvaluationDoc | null>;
  /** Insert (expectedVersion 0) or update guarded by version; null on a conflict. */
  saveEvaluation: (
    clubId: string,
    season: string,
    expectedVersion: number,
    changes: Pick<LicensingEvaluationDoc, "inputs" | "updatedAt" | "updatedBy">,
  ) => Promise<LicensingEvaluationDoc | null>;
}

export type StoredLicensingSubmission = Omit<LicensingSubmissionDoc, "_id"> & { id: string };

export interface LicensingSubmissionStore {
  /** null when the season is already closed (unique clubId + season among valid closings). */
  addSubmission: (
    doc: Omit<LicensingSubmissionDoc, "_id">,
  ) => Promise<StoredLicensingSubmission | null>;
  /** the valid (not reopened) closing of the season */
  findSubmission: (clubId: string, season: string) => Promise<StoredLicensingSubmission | null>;
  /** all closings including reopened ones (history) */
  listSubmissions: (clubId: string) => Promise<StoredLicensingSubmission[]>;
  /** marks the valid closing as reopened; null when the season is not closed */
  reopenSubmission: (
    clubId: string,
    season: string,
    reopenedBy: string,
    reopenedAt: Date,
  ) => Promise<StoredLicensingSubmission | null>;
}

export interface LicensingDeps extends ClubDeps {
  evaluations: EvaluationStore;
  licensingSubmissions: LicensingSubmissionStore;
}

export type LicensingAccess = "edit" | "read";

async function accessFor(
  deps: LicensingDeps,
  user: CurrentUser,
  clubId: string,
): Promise<LicensingAccess> {
  if (isAdmin(user)) return "edit";
  const season = currentSeason(deps.now?.() ?? new Date());
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.includes("management") || roles.includes("mentor")) return "edit";
  if (roles.includes("coach")) return "read";
  throw new ApiError("FORBIDDEN", "No access to this club's licensing evaluation");
}

/** Seasons with Sportnet data, newest first; the requested one must be among them. */
async function resolveSeason(deps: LicensingDeps, clubId: string, requested?: string | null) {
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const seasons = (await deps.clubs.listSeasonNames(clubId)).sort().reverse();
  if (seasons.length === 0) throw new ApiError("NOT_FOUND", "No Sportnet data for this club");
  if (requested) {
    if (!seasons.includes(requested)) throw new ApiError("NOT_FOUND", "Season not found");
    return { season: requested, seasons };
  }
  const current = currentSeason(deps.now?.() ?? new Date());
  return { season: seasons.includes(current) ? current : seasons[0], seasons };
}

export interface LicensingSubmissionSummary {
  id: string;
  season: string;
  closedAt: Date;
  closedBy: string;
  ruleSet: string;
  /** set when admin_sfz reopened the season (ADR 0008) */
  reopenedAt: Date | null;
}

const summary = (s: StoredLicensingSubmission): LicensingSubmissionSummary => ({
  id: s.id,
  season: s.season,
  closedAt: s.closedAt,
  closedBy: s.closedBy,
  ruleSet: s.ruleSet,
  reopenedAt: s.status === "reopened" ? (s.reopenedAt ?? null) : null,
});

export interface LicensingView {
  clubId: string;
  season: string;
  /** seasons with Sportnet data, newest first */
  seasons: string[];
  access: LicensingAccess;
  /** set when the season is closed; inputs and result are then the frozen copy */
  closed: LicensingSubmissionSummary | null;
  /** admin_sfz may reopen a closed season (ADR 0008) */
  canReopen: boolean;
  version: number;
  updatedAt: Date | null;
  dataAsOf: string | null;
  inputs: LicensingInputs;
  result: LicensingResult;
  /** Sportnet data of an open season, so clients can score live; null when closed or missing */
  sportnet: Pick<ClubSeasonDoc, "teams" | "players" | "coaches"> | null;
}

export async function getLicensing(
  deps: LicensingDeps,
  actor: CurrentUser | null,
  clubId: string,
  requestedSeason?: string | null,
): Promise<LicensingView> {
  const user = requireUser(actor);
  const access = await accessFor(deps, user, clubId);
  const { season, seasons } = await resolveSeason(deps, clubId, requestedSeason);
  const [evaluation, closed, seasonData] = await Promise.all([
    deps.evaluations.findEvaluation(clubId, season),
    deps.licensingSubmissions.findSubmission(clubId, season),
    deps.clubs.findSeason(clubId, season),
  ]);
  const base = {
    clubId,
    season,
    seasons,
    access,
    version: evaluation?.version ?? 0,
    updatedAt: evaluation?.updatedAt ?? null,
  };
  if (closed) {
    return {
      ...base,
      closed: summary(closed),
      canReopen: isAdmin(user),
      dataAsOf: closed.dataAsOf,
      inputs: closed.inputs,
      result: closed.result as unknown as LicensingResult,
      sportnet: null,
    };
  }
  const inputs = evaluation?.inputs ?? EMPTY_INPUTS;
  return {
    ...base,
    closed: null,
    canReopen: false,
    dataAsOf: seasonData?.dataAsOf ?? null,
    inputs,
    result: scoreLicensing(seasonData, inputs),
    sportnet: seasonData
      ? { teams: seasonData.teams, players: seasonData.players, coaches: seasonData.coaches }
      : null,
  };
}

const count = z.number().int().min(0).max(9999);
const itemValue = (item: ScoredItem) => (item.type === "toggle" ? z.boolean() : count);
const strictRecord = (shape: Record<string, z.ZodTypeAny>) =>
  z.object(Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.optional()]))).strict();

export const licensingInputsSchema = z.object({
  population: z.number().int().min(0).max(10_000_000).nullable(),
  infrastructure: strictRecord(
    Object.fromEntries(INFRASTRUCTURE_ITEMS.map(([key]) => [key, count])),
  ),
  activities: strictRecord({
    ...Object.fromEntries(ACTIVITY_ITEMS.map((i) => [i.key, itemValue(i)])),
    ...Object.fromEntries(ACTIVITY_RECORDS.map((key) => [key, count])),
  }),
  cooperation: strictRecord({
    ...Object.fromEntries(COOPERATION_ITEMS.map((i) => [i.key, itemValue(i)])),
    ...Object.fromEntries(COOPERATION_RECORDS.map((key) => [key, z.boolean()])),
  }),
  coachGender: z.record(z.string().min(1).max(200), z.enum(["M", "F"])),
});

export const saveLicensingSchema = z.object({
  season: z.string(),
  inputs: licensingInputsSchema,
  expectedVersion: z.number().int().nonnegative(),
});

/** Drops zero / false / undefined values so stored inputs stay small and comparable. */
function compact(values: Record<string, unknown>): Record<string, number | boolean> {
  return Object.fromEntries(
    Object.entries(values).filter(
      (e): e is [string, number | boolean] =>
        (typeof e[1] === "number" && e[1] !== 0) || e[1] === true,
    ),
  );
}

async function requireEditableSeason(
  deps: LicensingDeps,
  user: CurrentUser,
  clubId: string,
  season: string,
) {
  if ((await accessFor(deps, user, clubId)) !== "edit") {
    throw new ApiError("FORBIDDEN", "Only club management or the mentor can edit");
  }
  await resolveSeason(deps, clubId, season);
  if (await deps.licensingSubmissions.findSubmission(clubId, season)) {
    throw new ApiError("CONFLICT", "This season is closed");
  }
}

export async function saveLicensing(
  deps: LicensingDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<LicensingView> {
  const user = requireUser(actor);
  const data = saveLicensingSchema.parse(input);
  await requireEditableSeason(deps, user, clubId, data.season);

  const coaches = new Set(
    ((await deps.clubs.findSeason(clubId, data.season))?.coaches ?? []).map((c) => c.name),
  );
  if (Object.keys(data.inputs.coachGender).some((name) => !coaches.has(name))) {
    throw new ApiError("BAD_REQUEST", "Unknown coach");
  }
  const inputs: LicensingInputs = {
    population: data.inputs.population,
    infrastructure: compact(data.inputs.infrastructure) as Record<string, number>,
    activities: compact(data.inputs.activities),
    cooperation: compact(data.inputs.cooperation),
    coachGender: data.inputs.coachGender,
  };
  const saved = await deps.evaluations.saveEvaluation(clubId, data.season, data.expectedVersion, {
    inputs,
    updatedAt: deps.now?.() ?? new Date(),
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "The evaluation was changed by someone else");
  return getLicensing(deps, user, clubId, data.season);
}

export const closeLicensingSchema = z.object({
  season: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

/** Closes the season: frozen copy of inputs and result; the season can no longer be edited. */
export async function closeLicensing(
  deps: LicensingDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<LicensingSubmissionSummary> {
  const user = requireUser(actor);
  const { season, expectedVersion } = closeLicensingSchema.parse(input);
  await requireEditableSeason(deps, user, clubId, season);
  const view = await getLicensing(deps, user, clubId, season);
  if (view.version !== expectedVersion) {
    throw new ApiError("CONFLICT", "Save the latest changes before closing");
  }
  const stored = await deps.licensingSubmissions.addSubmission({
    clubId,
    season,
    ruleSet: LICENSING_RULE_SET,
    evaluationVersion: view.version,
    inputs: view.inputs,
    result: view.result as unknown as Record<string, unknown>,
    dataAsOf: view.dataAsOf,
    closedAt: deps.now?.() ?? new Date(),
    closedBy: user.id,
    status: "closed",
  });
  if (!stored) throw new ApiError("CONFLICT", "This season is closed");
  return summary(stored);
}

export async function listLicensingSubmissions(
  deps: LicensingDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<LicensingSubmissionSummary[]> {
  const user = requireUser(actor);
  await accessFor(deps, user, clubId);
  return (await deps.licensingSubmissions.listSubmissions(clubId))
    .sort((a, b) => b.season.localeCompare(a.season))
    .map(summary);
}

export const reopenLicensingSchema = z.object({ season: z.string() });

/** Reopens a closed season (admin_sfz only, ADR 0008). Nothing is deleted: the closing stays in the
 *  history marked as reopened, the working version can be edited and closed again. */
export async function reopenLicensing(
  deps: LicensingDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<LicensingSubmissionSummary> {
  const user = requireUser(actor);
  if (!isAdmin(user)) throw new ApiError("FORBIDDEN", "Only admin_sfz can reopen a season");
  const { season } = reopenLicensingSchema.parse(input);
  await resolveSeason(deps, clubId, season);
  const reopened = await deps.licensingSubmissions.reopenSubmission(
    clubId,
    season,
    user.id,
    deps.now?.() ?? new Date(),
  );
  if (!reopened) throw new ApiError("CONFLICT", "This season is not closed");
  return summary(reopened);
}
