import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { PracticeProgressDoc, PracticeProgressStep } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { PracticeContent } from "@/server/services/practice.schema";
import { getPractice, type PracticeStore } from "@/server/services/practice.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Progress of a club in the Prax of an area (F6d). Decisions 17. 10. 2026:
 * - one shared record per club, area and season (each role has its own steps, so they don't clash);
 * - management and coaches write, the union mentor reads, admin_sfz writes;
 * - nothing is stored without sign-in; not shown in the Vizitka;
 * - indicators and mentor numbers come later.
 * Every query is scoped by clubId (ADR 0003).
 */
export interface PracticeProgressStore {
  findProgress: (
    clubId: string,
    season: string,
    area: number,
  ) => Promise<PracticeProgressDoc | null>;
  /** Insert (expectedVersion 0) or update guarded by version; null on a conflict. */
  saveProgress: (
    clubId: string,
    season: string,
    area: number,
    expectedVersion: number,
    changes: Pick<PracticeProgressDoc, "tasks" | "steps" | "updatedAt" | "updatedBy">,
  ) => Promise<PracticeProgressDoc | null>;
}

export interface PracticeProgressDeps extends ClubDeps {
  practice: Pick<PracticeStore, "findPractice">;
  progress: PracticeProgressStore;
}

export type ProgressAccess = "edit" | "read";

async function accessFor(
  deps: PracticeProgressDeps,
  user: CurrentUser,
  clubId: string,
  season: string,
): Promise<ProgressAccess> {
  if (isAdmin(user)) return "edit";
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.includes("management") || roles.includes("coach")) return "edit";
  if (roles.includes("mentor")) return "read";
  throw new ApiError("FORBIDDEN", "No access to this club's practice progress");
}

export interface RoleProgress {
  roleId: string;
  tasksDone: number;
  tasksTotal: number;
  stepsDone: number;
  stepsTotal: number;
  /** first step of the path that is not done yet, null when all are done */
  nextStepId: string | null;
}

/** Pure: progress of every Prax role from the shared record. */
export function summarizeProgress(
  content: Pick<PracticeContent, "roles">,
  progress: Pick<PracticeProgressDoc, "tasks" | "steps"> | null,
): RoleProgress[] {
  const tasks = new Set(progress?.tasks ?? []);
  const done = new Set((progress?.steps ?? []).filter((s) => s.done).map((s) => s.stepId));
  return content.roles.map((r) => ({
    roleId: r.id,
    tasksDone: r.firstStep.tasks.filter((t) => tasks.has(t.id)).length,
    tasksTotal: r.firstStep.tasks.length,
    stepsDone: r.steps.filter((s) => done.has(s.id)).length,
    stepsTotal: r.steps.length,
    nextStepId: r.steps.find((s) => !done.has(s.id))?.id ?? null,
  }));
}

export interface PracticeProgressView {
  clubId: string;
  season: string;
  area: number;
  access: ProgressAccess;
  version: number;
  updatedAt: Date | null;
  tasks: string[];
  steps: PracticeProgressStep[];
  roles: RoleProgress[];
}

async function practiceFor(deps: PracticeProgressDeps, user: CurrentUser, area: number) {
  const practice = await getPractice(deps.practice, user, area);
  if (!practice) throw new ApiError("NOT_FOUND", "This area has no practice");
  return practice.content;
}

export async function getPracticeProgress(
  deps: PracticeProgressDeps,
  actor: CurrentUser | null,
  clubId: string,
  area: number,
): Promise<PracticeProgressView> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const access = await accessFor(deps, user, clubId, season);
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const [content, progress] = await Promise.all([
    practiceFor(deps, user, area),
    deps.progress.findProgress(clubId, season, area),
  ]);
  return {
    clubId,
    season,
    area,
    access,
    version: progress?.version ?? 0,
    updatedAt: progress?.updatedAt ?? null,
    tasks: progress?.tasks ?? [],
    steps: progress?.steps ?? [],
    roles: summarizeProgress(content, progress),
  };
}

export const saveProgressSchema = z.object({
  tasks: z.array(z.string().min(1).max(40)).max(200),
  steps: z
    .array(
      z.object({
        stepId: z.string().min(1).max(40),
        option: z.number().int().nonnegative().nullable(),
        done: z.boolean(),
      }),
    )
    .max(100),
  expectedVersion: z.number().int().nonnegative(),
});

/** Pure: validates ids against the Prax content and keeps `doneAt` of steps that stay done. */
export function buildProgress(
  content: Pick<PracticeContent, "roles">,
  input: z.infer<typeof saveProgressSchema>,
  previous: Pick<PracticeProgressDoc, "steps"> | null,
  now: Date,
): Pick<PracticeProgressDoc, "tasks" | "steps"> {
  const taskIds = new Set(content.roles.flatMap((r) => r.firstStep.tasks.map((t) => t.id)));
  const stepOptions = new Map(
    content.roles.flatMap((r) => r.steps.map((s) => [s.id, s.options.length] as const)),
  );
  const tasks = [...new Set(input.tasks)];
  if (tasks.some((id) => !taskIds.has(id))) throw new ApiError("BAD_REQUEST", "Unknown task");
  const seen = new Set<string>();
  const steps: PracticeProgressStep[] = [];
  for (const s of input.steps) {
    const options = stepOptions.get(s.stepId);
    if (options === undefined) throw new ApiError("BAD_REQUEST", "Unknown step");
    if (s.option !== null && s.option >= options) {
      throw new ApiError("BAD_REQUEST", "Unknown option");
    }
    if (seen.has(s.stepId)) throw new ApiError("BAD_REQUEST", "Duplicate step");
    seen.add(s.stepId);
    if (s.option === null && !s.done) continue; // nothing to keep
    const before = previous?.steps.find((p) => p.stepId === s.stepId);
    steps.push({
      stepId: s.stepId,
      option: s.option,
      done: s.done,
      doneAt: s.done ? (before?.done && before.doneAt ? before.doneAt : now) : null,
    });
  }
  return {
    tasks: tasks.sort(),
    steps: steps.sort((a, b) => a.stepId.localeCompare(b.stepId)),
  };
}

export async function savePracticeProgress(
  deps: PracticeProgressDeps,
  actor: CurrentUser | null,
  clubId: string,
  area: number,
  input: unknown,
): Promise<PracticeProgressView> {
  const user = requireUser(actor);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  if ((await accessFor(deps, user, clubId, season)) !== "edit") {
    throw new ApiError("FORBIDDEN", "Only club management and coaches can save progress");
  }
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const data = saveProgressSchema.parse(input);
  const [content, previous] = await Promise.all([
    practiceFor(deps, user, area),
    deps.progress.findProgress(clubId, season, area),
  ]);
  const next = buildProgress(content, data, previous, now);
  const saved = await deps.progress.saveProgress(clubId, season, area, data.expectedVersion, {
    ...next,
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "Progress was changed by someone else");
  return getPracticeProgress(deps, user, clubId, area);
}
