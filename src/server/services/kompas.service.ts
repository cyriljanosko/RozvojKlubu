import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { KompasAssessmentDoc } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { ContentStore } from "@/server/services/content.service";
import {
  clubCategories,
  isQuestionValid,
  scoreKompas,
  type ClubCategory,
  type KompasResult,
} from "@/server/services/kompas-scoring";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Kompas klubu in the app (F4). Decisions 16. 10. 2026:
 * - management (vedenie) and admin_sfz fill it in; coaches see the result read-only;
 *   mentors see only submitted versions (F4c), never the working draft;
 * - club categories come from Sportnet (snapshot) only; no manual score mode.
 * Every query is scoped by clubId (ADR 0003).
 */
export interface AssessmentStore {
  findAssessment: (clubId: string, season: string) => Promise<KompasAssessmentDoc | null>;
  /** Insert (expectedVersion 0) or update guarded by version; null on a conflict. */
  saveAssessment: (
    clubId: string,
    season: string,
    expectedVersion: number,
    changes: Pick<KompasAssessmentDoc, "answers" | "updatedAt" | "updatedBy">,
  ) => Promise<KompasAssessmentDoc | null>;
}

export interface KompasDeps extends ClubDeps {
  content: Pick<ContentStore, "listQuestions">;
  assessments: AssessmentStore;
}

export type KompasAccess = "edit" | "read";

async function accessFor(
  deps: KompasDeps,
  user: CurrentUser,
  clubId: string,
  season: string,
): Promise<KompasAccess> {
  if (isAdmin(user)) return "edit";
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.includes("management")) return "edit";
  if (roles.includes("coach")) return "read";
  throw new ApiError("FORBIDDEN", "No access to this club's Kompas");
}

/** Categories from the current season's teams, falling back to the latest season with data. */
async function categoriesFor(deps: KompasDeps, clubId: string, season: string) {
  const current = await deps.clubs.findSeason(clubId, season);
  if (current) return { categories: clubCategories(current.teams), from: season };
  const latest = (await deps.clubs.listSeasonNames(clubId)).sort().at(-1);
  const data = latest ? await deps.clubs.findSeason(clubId, latest) : null;
  return { categories: data ? clubCategories(data.teams) : [], from: latest ?? null };
}

export interface KompasQuestionView {
  questionId: string;
  area: number;
  column: "i" | "s";
  order: number;
  text: string;
  tags: string[];
  valid: boolean;
  checked: boolean;
}

export interface KompasView {
  clubId: string;
  season: string;
  access: KompasAccess;
  categories: ClubCategory[];
  categoriesFromSeason: string | null;
  version: number;
  updatedAt: Date | null;
  questions: KompasQuestionView[];
  result: KompasResult;
}

export async function getKompas(
  deps: KompasDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<KompasView> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const access = await accessFor(deps, user, clubId, season);
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");

  const [{ categories, from }, questions, assessment] = await Promise.all([
    categoriesFor(deps, clubId, season),
    deps.content.listQuestions(),
    deps.assessments.findAssessment(clubId, season),
  ]);
  const answers = new Set(assessment?.answers ?? []);
  const sorted = [...questions].sort(
    (a, b) => a.area - b.area || a.column.localeCompare(b.column) || a.order - b.order,
  );
  return {
    clubId,
    season,
    access,
    categories,
    categoriesFromSeason: from,
    version: assessment?.version ?? 0,
    updatedAt: assessment?.updatedAt ?? null,
    questions: sorted.map((q) => ({
      questionId: q.questionId,
      area: q.area,
      column: q.column,
      order: q.order,
      text: q.text,
      tags: q.tags,
      valid: isQuestionValid(q.tags, categories),
      checked: answers.has(q.questionId),
    })),
    result: scoreKompas(sorted, categories, answers),
  };
}

export const saveAnswersSchema = z.object({
  answers: z.array(z.string().regex(/^\d{1,2}\.[is]\.\d{1,2}$/)).max(220),
  expectedVersion: z.number().int().nonnegative(),
});

export async function saveKompasAnswers(
  deps: KompasDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<KompasView> {
  const user = requireUser(actor);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  if ((await accessFor(deps, user, clubId, season)) !== "edit") {
    throw new ApiError("FORBIDDEN", "Only club management can fill in the Kompas");
  }
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const data = saveAnswersSchema.parse(input);
  const known = new Set((await deps.content.listQuestions()).map((q) => q.questionId));
  const answers = [...new Set(data.answers)];
  if (answers.some((id) => !known.has(id))) throw new ApiError("BAD_REQUEST", "Unknown question");

  const saved = await deps.assessments.saveAssessment(clubId, season, data.expectedVersion, {
    answers: answers.sort(),
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "Kompas was changed by someone else");
  return getKompas(deps, user, clubId);
}
