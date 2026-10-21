import { randomUUID } from "node:crypto";

import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { ClubPlanDoc, PlanGoal, PlanGoalStatus } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { KompasResult } from "@/server/services/kompas-scoring";
import {
  isValidSubmission,
  type SubmissionStore,
} from "@/server/services/kompas-submission.service";
import { getKompas, type KompasDeps } from "@/server/services/kompas.service";
import { clubMembers } from "@/server/services/mentor-visit.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * The club's plan for a season (decision 21. 10. 2026, after the FAF/DFB analysis – EFQM "direction"):
 * goals per area with a responsible person and a due date, status todo → doing → done.
 * - management and the club's mentor (and admin_sfz) write, coaches read;
 * - the responsible member may change the status of their goal;
 * - the mentor (or admin_sfz) may confirm the plan – optional;
 * - every goal has a public sentence for the public Vizitka (area, sentence, status – no names).
 * One plan per club and season. Every query is scoped by clubId (ADR 0003).
 */
export interface PlanStore {
  findPlan: (clubId: string, season: string) => Promise<ClubPlanDoc | null>;
  /** Insert (expectedVersion 0) or update guarded by version; null on a conflict. */
  savePlan: (
    clubId: string,
    season: string,
    expectedVersion: number,
    changes: Pick<ClubPlanDoc, "goals" | "confirmedAt" | "confirmedBy" | "updatedAt" | "updatedBy">,
  ) => Promise<ClubPlanDoc | null>;
}

export interface ClubPlanDeps extends ClubDeps {
  plans: PlanStore;
  submissions: Pick<SubmissionStore, "listSubmissions">;
  kompas: KompasDeps;
}

export type PlanAccess = "edit" | "read";

export const MAX_GOALS = 10;
/** goals offered on an empty plan (decision 21. 10. 2026) */
export const SUGGESTED_GOALS = 2;

async function accessFor(
  deps: ClubPlanDeps,
  user: CurrentUser,
  clubId: string,
  season: string,
): Promise<{ access: PlanAccess; roles: string[] }> {
  if (isAdmin(user)) return { access: "edit", roles: [] };
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.includes("management") || roles.includes("mentor")) return { access: "edit", roles };
  if (roles.includes("coach")) return { access: "read", roles };
  throw new ApiError("FORBIDDEN", "No access to this club's plan");
}

const isoDate = z.iso.date();
const text = (max: number) => z.string().trim().max(max);

export const planInputSchema = z.object({
  goals: z
    .array(
      z.object({
        /** id of an existing goal (keeps status history); omitted for a new one */
        id: z.string().max(64).optional(),
        area: z.number().int().min(1).max(11),
        title: text(300).min(1),
        publicText: text(300).min(1),
        indicator: text(500),
        owner: text(120).min(1),
        ownerId: z.string().min(1).max(64).nullable(),
        dueDate: isoDate.nullable(),
        status: z.enum(["todo", "doing", "done"]),
      }),
    )
    .max(MAX_GOALS),
  expectedVersion: z.number().int().nonnegative(),
});

/** Pure: validated goals; `doneAt` is kept while a goal stays done and set when it becomes done. */
export function buildGoals(
  input: z.infer<typeof planInputSchema>["goals"],
  previous: readonly PlanGoal[],
  now: Date,
  newId: () => string = randomUUID,
): PlanGoal[] {
  return input.map((g) => {
    const before = g.id ? previous.find((p) => p.id === g.id) : undefined;
    return {
      id: before?.id ?? newId(),
      area: g.area,
      title: g.title,
      publicText: g.publicText,
      indicator: g.indicator,
      owner: g.owner,
      ownerId: g.ownerId,
      dueDate: g.dueDate,
      status: g.status,
      doneAt: g.status === "done" ? (before?.status === "done" ? before.doneAt : now) : null,
    };
  });
}

/** Pure: the two weakest areas of a Kompas result – offered as the first goals. */
export function suggestAreas(
  result: Pick<KompasResult, "next"> | null,
  count = SUGGESTED_GOALS,
): number[] {
  return (result?.next ?? []).slice(0, count).map((n) => n.area);
}

export interface PlanTask {
  goalId: string;
  area: number;
  title: string;
  dueDate: string;
  overdue: boolean;
}

/** Pure: goals not done that are overdue or due within `soonDays` – for the owner and management. */
export function planTasksFor(
  plan: Pick<ClubPlanDoc, "goals"> | null,
  viewer: { userId: string; management: boolean },
  today: string,
  soonDays = 14,
): PlanTask[] {
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + soonDays);
  const limit = soon.toISOString().slice(0, 10);
  return (plan?.goals ?? [])
    .filter((g) => g.status !== "done" && g.dueDate !== null && g.dueDate <= limit)
    .filter((g) => g.ownerId === viewer.userId || viewer.management)
    .map((g) => ({
      goalId: g.id,
      area: g.area,
      title: g.title,
      dueDate: g.dueDate!,
      overdue: g.dueDate! < today,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Pure: how far the plan is – for the Vizitka and the mentor overview. */
export function summarizePlan(plan: Pick<ClubPlanDoc, "goals" | "confirmedAt"> | null) {
  const goals = plan?.goals ?? [];
  return {
    goals: goals.length,
    done: goals.filter((g) => g.status === "done").length,
    doing: goals.filter((g) => g.status === "doing").length,
    confirmed: plan?.confirmedAt != null,
  };
}

export interface PlanView {
  clubId: string;
  season: string;
  access: PlanAccess;
  viewerId: string;
  /** mentor or admin_sfz – may confirm */
  canConfirm: boolean;
  plan: Omit<ClubPlanDoc, "_id"> | null;
  members: { userId: string; name: string; roles: string[] }[];
  /** areas offered on an empty plan (the weakest of the Kompas) */
  suggestions: number[];
}

async function weakestAreas(deps: ClubPlanDeps, user: CurrentUser, clubId: string, season: string) {
  const subs = await deps.submissions.listSubmissions(clubId, season);
  const latest = subs.filter(isValidSubmission).sort((a, b) => +b.submittedAt - +a.submittedAt)[0];
  if (latest) return suggestAreas(latest.result as unknown as KompasResult);
  try {
    // the working Kompas – only management and admin_sfz may read it
    return suggestAreas((await getKompas(deps.kompas, user, clubId)).result);
  } catch {
    return [];
  }
}

export async function getClubPlan(
  deps: ClubPlanDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<PlanView> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const { access, roles } = await accessFor(deps, user, clubId, season);
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const [doc, members] = await Promise.all([
    deps.plans.findPlan(clubId, season),
    clubMembers(deps, clubId),
  ]);
  let plan: PlanView["plan"] = null;
  if (doc) {
    const { _id, ...rest } = doc;
    void _id;
    plan = rest;
  }
  return {
    clubId,
    season,
    access,
    viewerId: user.id,
    canConfirm: isAdmin(user) || roles.includes("mentor"),
    plan,
    members,
    suggestions:
      access === "edit" && (plan?.goals.length ?? 0) === 0
        ? await weakestAreas(deps, user, clubId, season)
        : [],
  };
}

async function requireMembers(deps: ClubPlanDeps, clubId: string, ids: readonly string[]) {
  if (ids.length === 0) return;
  const known = new Set((await clubMembers(deps, clubId)).map((m) => m.userId));
  if (ids.some((id) => !known.has(id))) {
    throw new ApiError("BAD_REQUEST", "Responsible person is not a member of the club");
  }
}

export async function saveClubPlan(
  deps: ClubPlanDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<PlanView> {
  const user = requireUser(actor);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  if ((await accessFor(deps, user, clubId, season)).access !== "edit") {
    throw new ApiError("FORBIDDEN", "Only management and the club's mentor can change the plan");
  }
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const data = planInputSchema.parse(input);
  await requireMembers(
    deps,
    clubId,
    data.goals.flatMap((g) => (g.ownerId ? [g.ownerId] : [])),
  );
  const previous = await deps.plans.findPlan(clubId, season);
  const saved = await deps.plans.savePlan(clubId, season, data.expectedVersion, {
    goals: buildGoals(data.goals, previous?.goals ?? [], now),
    confirmedAt: previous?.confirmedAt ?? null,
    confirmedBy: previous?.confirmedBy ?? null,
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "The plan was changed by someone else");
  return getClubPlan(deps, user, clubId);
}

const statusSchema = z.object({
  status: z.enum(["todo", "doing", "done"]),
  expectedVersion: z.number().int().positive(),
});

/** Change the status of one goal – management, the mentor, admin_sfz or the goal's owner. */
export async function setGoalStatus(
  deps: ClubPlanDeps,
  actor: CurrentUser | null,
  clubId: string,
  goalId: string,
  input: unknown,
): Promise<PlanView> {
  const user = requireUser(actor);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  const { access } = await accessFor(deps, user, clubId, season);
  const data = statusSchema.parse(input);
  const plan = await deps.plans.findPlan(clubId, season);
  const goal = plan?.goals.find((g) => g.id === goalId);
  if (!plan || !goal) throw new ApiError("NOT_FOUND", "Goal not found");
  if (access !== "edit" && goal.ownerId !== user.id) {
    throw new ApiError("FORBIDDEN", "Only the responsible person or management can change it");
  }
  const status: PlanGoalStatus = data.status;
  const saved = await deps.plans.savePlan(clubId, season, data.expectedVersion, {
    goals: plan.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            status,
            doneAt: status === "done" ? (g.status === "done" ? g.doneAt : now) : null,
          }
        : g,
    ),
    confirmedAt: plan.confirmedAt,
    confirmedBy: plan.confirmedBy,
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "The plan was changed by someone else");
  return getClubPlan(deps, user, clubId);
}

/** The club's mentor (or admin_sfz) confirms the plan – optional; `confirmed: false` takes it back. */
export async function confirmClubPlan(
  deps: ClubPlanDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<PlanView> {
  const user = requireUser(actor);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  const view = await getClubPlan(deps, user, clubId);
  if (!view.canConfirm) {
    throw new ApiError("FORBIDDEN", "Only the club's mentor or admin_sfz can confirm the plan");
  }
  const data = z
    .object({ confirmed: z.boolean(), expectedVersion: z.number().int().positive() })
    .parse(input);
  if (!view.plan || view.plan.goals.length === 0) {
    throw new ApiError("BAD_REQUEST", "There is no plan to confirm");
  }
  const saved = await deps.plans.savePlan(clubId, season, data.expectedVersion, {
    goals: view.plan.goals,
    confirmedAt: data.confirmed ? now : null,
    confirmedBy: data.confirmed ? user.id : null,
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "The plan was changed by someone else");
  return getClubPlan(deps, user, clubId);
}

export interface PublicPlan {
  season: string;
  goals: { area: number; publicText: string; status: PlanGoalStatus }[];
}

/** Public Vizitka: only the area, the public sentence and the status – never names. */
export async function getPublicPlan(
  deps: Pick<ClubPlanDeps, "plans" | "now">,
  clubId: string,
  season?: string,
): Promise<PublicPlan> {
  const s = season ?? currentSeason(deps.now?.() ?? new Date());
  const plan = await deps.plans.findPlan(clubId, s);
  return {
    season: s,
    goals: (plan?.goals ?? []).map((g) => ({
      area: g.area,
      publicText: g.publicText,
      status: g.status,
    })),
  };
}
