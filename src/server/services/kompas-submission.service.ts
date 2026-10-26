import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { KompasSubmissionDoc } from "@/server/db/types";
import { clubRolesFor, isAdmin, memberClubIds } from "@/server/services/club-access";
import { kompasLine, profileFromSeason } from "@/server/services/kompas-export";
import type { KompasResult } from "@/server/services/kompas-scoring";
import { getKompas, type KompasDeps } from "@/server/services/kompas.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Sending the Kompas to the mentor = a frozen copy (answers, question texts, result, transfer line).
 * The club can keep editing and send again; submissions are the history.
 * Access: management/admin submit; management, coach and mentor of the club read submissions;
 * the club's mentor or admin_sfz confirm a submission (a badge in the rankings, ADR 0015).
 */
export interface SubmissionStore {
  addSubmission: (doc: Omit<KompasSubmissionDoc, "_id">) => Promise<StoredSubmission>;
  listSubmissions: (clubId: string, season?: string) => Promise<StoredSubmission[]>;
  findSubmission: (clubId: string, submissionId: string) => Promise<StoredSubmission | null>;
  /** marks a submission as withdrawn; null when not found or already withdrawn */
  withdrawSubmission: (
    clubId: string,
    submissionId: string,
    withdrawnBy: string,
    withdrawnAt: Date,
  ) => Promise<StoredSubmission | null>;
  /** sets or clears the mentor's confirmation; null when not found or withdrawn */
  setConfirmation: (
    clubId: string,
    submissionId: string,
    confirmation: { by: string; at: Date } | null,
  ) => Promise<StoredSubmission | null>;
}

/** A withdrawn submission stays in the history but no longer counts anywhere (ADR 0009). */
export const isValidSubmission = (s: Pick<KompasSubmissionDoc, "status">) =>
  s.status !== "withdrawn";

export type StoredSubmission = Omit<KompasSubmissionDoc, "_id"> & { id: string };

export interface SubmissionDeps extends KompasDeps {
  submissions: SubmissionStore;
}

export interface SubmissionSummary {
  id: string;
  clubId: string;
  season: string;
  submittedAt: Date;
  total: number;
  filledAreas: number;
  line: string;
  /** set when admin_sfz withdrew the submission (ADR 0009) */
  withdrawnAt: Date | null;
  /** set when the club's mentor or admin_sfz confirmed it (ADR 0015) */
  confirmedAt: Date | null;
}

const summary = (s: StoredSubmission): SubmissionSummary => {
  const r = s.result as unknown as KompasResult;
  return {
    id: s.id,
    clubId: s.clubId,
    season: s.season,
    submittedAt: s.submittedAt,
    total: r.total,
    filledAreas: r.filledAreas,
    line: s.line,
    withdrawnAt: s.status === "withdrawn" ? (s.withdrawnAt ?? null) : null,
    confirmedAt: s.confirmedAt ?? null,
  };
};

async function requireReader(deps: SubmissionDeps, user: CurrentUser, clubId: string) {
  if (isAdmin(user)) return;
  const season = currentSeason(deps.now?.() ?? new Date());
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.length === 0) throw new ApiError("FORBIDDEN", "No access to this club");
}

export async function submitKompas(
  deps: SubmissionDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<SubmissionSummary> {
  const user = requireUser(actor);
  const { expectedVersion } = z
    .object({ expectedVersion: z.number().int().positive() })
    .parse(input);
  const view = await getKompas(deps, user, clubId); // checks club access
  if (view.access !== "edit") throw new ApiError("FORBIDDEN", "Only club management can submit");
  if (view.version !== expectedVersion) {
    throw new ApiError("CONFLICT", "Save the latest answers before submitting");
  }
  if (view.result.filledAreas === 0) throw new ApiError("BAD_REQUEST", "Nothing to submit");

  const club = (await deps.clubs.findClub(clubId))!;
  const seasonData =
    (await deps.clubs.findSeason(clubId, view.season)) ??
    (view.categoriesFromSeason
      ? await deps.clubs.findSeason(clubId, view.categoriesFromSeason)
      : null);
  const line = kompasLine({
    clubName: club.name,
    union: club.union,
    region: club.region,
    season: view.season,
    result: view.result,
    profile: profileFromSeason(seasonData),
  });
  const stored = await deps.submissions.addSubmission({
    clubId,
    season: view.season,
    assessmentVersion: view.version,
    answers: view.questions.filter((q) => q.checked).map((q) => q.questionId),
    categories: view.categories,
    questions: view.questions.map((q) => ({
      questionId: q.questionId,
      text: q.text,
      tags: q.tags,
    })),
    result: view.result as unknown as Record<string, unknown>,
    line,
    submittedAt: deps.now?.() ?? new Date(),
    submittedBy: user.id,
    status: "submitted",
  });
  return summary(stored);
}

export async function listClubSubmissions(
  deps: SubmissionDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<SubmissionSummary[]> {
  const user = requireUser(actor);
  await requireReader(deps, user, clubId);
  return (await deps.submissions.listSubmissions(clubId))
    .sort((a, b) => +b.submittedAt - +a.submittedAt)
    .map(summary);
}

export async function getSubmission(
  deps: SubmissionDeps,
  actor: CurrentUser | null,
  clubId: string,
  submissionId: string,
): Promise<StoredSubmission> {
  const user = requireUser(actor);
  await requireReader(deps, user, clubId);
  const s = await deps.submissions.findSubmission(clubId, submissionId);
  if (!s) throw new ApiError("NOT_FOUND", "Submission not found");
  return s;
}

export interface MentorClubRow {
  clubId: string;
  name: string;
  union: string;
  latest: SubmissionSummary | null;
}

/** Mentor overview: clubs where the user is mentor this season (admin: all clubs), latest submission each. */
export async function listMentorClubs(
  deps: SubmissionDeps,
  actor: CurrentUser | null,
): Promise<MentorClubRow[]> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const memberships = await deps.memberships.listByUser(user.id);
  const mentorIds = memberClubIds(
    memberships.filter((m) => m.role === "mentor"),
    season,
  );
  if (!isAdmin(user) && mentorIds.length === 0) throw new ApiError("FORBIDDEN", "Not a mentor");
  const clubs = await deps.clubs.listClubs(isAdmin(user) ? "all" : mentorIds);
  const rows = await Promise.all(
    clubs.map(async (c) => {
      const subs = (await deps.submissions.listSubmissions(c.clubId, season))
        .filter(isValidSubmission)
        .sort((a, b) => +b.submittedAt - +a.submittedAt);
      return {
        clubId: c.clubId,
        name: c.name,
        union: c.union,
        latest: subs[0] ? summary(subs[0]) : null,
      };
    }),
  );
  return rows.sort((a, b) => a.name.localeCompare(b.name, "sk"));
}

/** Withdraws a submission (admin_sfz only, ADR 0009). Nothing is deleted: it stays in the history
 *  marked as withdrawn; the Vizitka and the mentor overview fall back to the previous valid one. */
export async function withdrawKompasSubmission(
  deps: SubmissionDeps,
  actor: CurrentUser | null,
  clubId: string,
  submissionId: string,
): Promise<SubmissionSummary> {
  const user = requireUser(actor);
  if (!isAdmin(user)) throw new ApiError("FORBIDDEN", "Only admin_sfz can withdraw a submission");
  const existing = await deps.submissions.findSubmission(clubId, submissionId);
  if (!existing) throw new ApiError("NOT_FOUND", "Submission not found");
  if (!isValidSubmission(existing)) throw new ApiError("CONFLICT", "Already withdrawn");
  const withdrawn = await deps.submissions.withdrawSubmission(
    clubId,
    submissionId,
    user.id,
    deps.now?.() ?? new Date(),
  );
  if (!withdrawn) throw new ApiError("CONFLICT", "Already withdrawn");
  return summary(withdrawn);
}

/** Confirms a submission or takes the confirmation back – the club's mentor of the season or
 *  admin_sfz (ADR 0015). A badge only: the stars stay the same; a withdrawn one cannot be confirmed. */
export async function confirmKompasSubmission(
  deps: SubmissionDeps,
  actor: CurrentUser | null,
  clubId: string,
  submissionId: string,
  confirmed: boolean,
): Promise<SubmissionSummary> {
  const user = requireUser(actor);
  if (!isAdmin(user)) {
    const season = currentSeason(deps.now?.() ?? new Date());
    const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
    if (!roles.includes("mentor")) {
      throw new ApiError("FORBIDDEN", "Only the club's mentor or admin_sfz can confirm");
    }
  }
  const existing = await deps.submissions.findSubmission(clubId, submissionId);
  if (!existing) throw new ApiError("NOT_FOUND", "Submission not found");
  if (!isValidSubmission(existing))
    throw new ApiError("CONFLICT", "A withdrawn Kompas cannot be confirmed");
  const saved = await deps.submissions.setConfirmation(
    clubId,
    submissionId,
    confirmed ? { by: user.id, at: deps.now?.() ?? new Date() } : null,
  );
  if (!saved) throw new ApiError("CONFLICT", "A withdrawn Kompas cannot be confirmed");
  return summary(saved);
}
