import { randomUUID } from "node:crypto";

import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type {
  MentorAssessment,
  MentorPrepTask,
  MentorRating,
  MentorVisitAction,
  MentorVisitDoc,
} from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { KompasResult } from "@/server/services/kompas-scoring";
import {
  isValidSubmission,
  type SubmissionStore,
} from "@/server/services/kompas-submission.service";
import type { PlanStore } from "@/server/services/club-plan.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Mentor visits (decision 21. 10. 2026, after the FAF/DFB analysis): the union mentor records a
 * visit to a club with agreed actions. Draft → sent to the club → withdrawn (nothing is deleted).
 * Mentoring cycle (MC, 22. 10. 2026): a visit may be planned ahead – the club sees its date, topics
 * and the task to prepare; the mentor assesses it in four fields and rates the task and the steps.
 * - the club's mentor of the season and admin_sfz write;
 * - management and coaches read sent visits and tick the agreed actions;
 * - names of people are visible only to the club, its mentor and admin_sfz (never public).
 * Every query is scoped by clubId (ADR 0003).
 */
export type StoredVisit = Omit<MentorVisitDoc, "_id"> & { id: string };

export interface MentorVisitStore {
  insertVisit: (doc: Omit<MentorVisitDoc, "_id">) => Promise<StoredVisit>;
  listVisits: (clubId: string) => Promise<StoredVisit[]>;
  findVisit: (clubId: string, visitId: string) => Promise<StoredVisit | null>;
  /** Atomic update guarded by `expectedVersion` (increments it); null on a conflict. */
  updateVisit: (
    clubId: string,
    visitId: string,
    expectedVersion: number,
    changes: Partial<
      Omit<MentorVisitDoc, "_id" | "clubId" | "version" | "createdBy" | "createdAt">
    >,
  ) => Promise<StoredVisit | null>;
}

export interface MentorVisitDeps extends ClubDeps {
  visits: MentorVisitStore;
  submissions: Pick<SubmissionStore, "listSubmissions">;
  /** the season's plan, shown in the reminder above the form (CP-b) */
  plans?: Pick<PlanStore, "findPlan">;
}

export type VisitAccess = "write" | "club";

async function accessFor(
  deps: MentorVisitDeps,
  user: CurrentUser,
  clubId: string,
): Promise<VisitAccess> {
  if (isAdmin(user)) return "write";
  const season = currentSeason(deps.now?.() ?? new Date());
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.includes("mentor")) return "write";
  if (roles.includes("management") || roles.includes("coach")) return "club";
  throw new ApiError("FORBIDDEN", "No access to this club's mentor visits");
}

async function requireClub(deps: MentorVisitDeps, clubId: string) {
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
}

/** People with a role in the club this season (who was present, who is responsible). */
export async function clubMembers(
  deps: Pick<ClubDeps, "memberships" | "users" | "now">,
  clubId: string,
) {
  const season = currentSeason(deps.now?.() ?? new Date());
  const memberships = await deps.memberships.listByClub(clubId, season);
  const ids = [...new Set(memberships.map((m) => m.userId))];
  const people = await Promise.all(ids.map((id) => deps.users.findById(id)));
  return ids
    .map((userId, i) => ({
      userId,
      name: people[i]?.name || people[i]?.email || userId,
      roles: [...new Set(memberships.filter((m) => m.userId === userId).map((m) => m.role))],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sk"));
}

async function requireMembers(deps: MentorVisitDeps, clubId: string, ids: readonly string[]) {
  if (ids.length === 0) return;
  const known = new Set((await clubMembers(deps, clubId)).map((m) => m.userId));
  if (ids.some((id) => !known.has(id))) {
    throw new ApiError("BAD_REQUEST", "Participant is not a member of the club");
  }
}

/**
 * Pure: what the visit detail shows. Anyone who sees a sent visit can tick its actions – the
 * responsible person may also be the club's mentor or admin_sfz (bug 21. 10. 2026); the mentor
 * and admin_sfz also edit until the visit is withdrawn.
 */
export function visitViewMode(
  access: VisitAccess,
  status: MentorVisitDoc["status"],
): { checklist: boolean; form: boolean } {
  return {
    checklist: status === "sent",
    form: access === "write" && status !== "withdrawn",
  };
}

/** Pure: the club sees sent and planned visits; the mentor and admin also drafts and withdrawn ones. */
export function visibleTo(access: VisitAccess, visit: Pick<MentorVisitDoc, "status">): boolean {
  return access === "write" || visit.status === "sent" || visit.status === "planned";
}

export interface VisitTask {
  visitId: string;
  actionId: string;
  text: string;
  dueDate: string | null;
  overdue: boolean;
}

/**
 * Pure: open agreed actions a club member should see as tasks (decision 21. 10. 2026) –
 * the responsible member, and management of the club to keep an eye on them.
 */
export function visitTasksFor(
  visits: readonly Pick<StoredVisit, "id" | "date" | "status" | "actions">[],
  viewer: { userId: string; management: boolean },
  today: string,
): VisitTask[] {
  return openActions(visits)
    .filter((a) => a.ownerId === viewer.userId || viewer.management)
    .map((a) => ({
      visitId: a.visitId,
      actionId: a.id,
      text: a.text,
      dueDate: a.dueDate,
      overdue: a.dueDate !== null && a.dueDate < today,
    }));
}

export interface VisitSummary {
  /** date of the latest sent visit in the season, null when none */
  lastDate: string | null;
  open: number;
  overdue: number;
  /** the next planned visit from today on (MC), null when none */
  nextPlanned: string | null;
}

/** Pure: the club's visits in a season for the mentor overview and the Vizitka. */
export function summarizeVisits(
  visits: readonly Pick<StoredVisit, "id" | "date" | "season" | "status" | "actions">[],
  season: string,
  today: string,
): VisitSummary {
  const sent = visits.filter((v) => v.status === "sent" && v.season === season);
  const open = openActions(sent);
  return {
    lastDate:
      sent
        .map((v) => v.date)
        .sort()
        .at(-1) ?? null,
    open: open.length,
    overdue: open.filter((a) => a.dueDate !== null && a.dueDate < today).length,
    nextPlanned:
      visits
        .filter((v) => v.status === "planned" && v.season === season && v.date >= today)
        .map((v) => v.date)
        .sort()[0] ?? null,
  };
}

/** Today as ISO date in Slovakia ("YYYY-MM-DD") – due dates are compared as dates. */
export const isoToday = (now: Date = new Date()) =>
  now.toLocaleDateString("sv-SE", { timeZone: "Europe/Bratislava" });

/** Pure: open agreed actions of sent visits, earliest due date first (tasks in Moja Akadémia). */
export function openActions(
  visits: readonly Pick<StoredVisit, "id" | "date" | "status" | "actions">[],
): (MentorVisitAction & { visitId: string; visitDate: string })[] {
  return visits
    .filter((v) => v.status === "sent")
    .flatMap((v) =>
      v.actions.filter((a) => !a.done).map((a) => ({ ...a, visitId: v.id, visitDate: v.date })),
    )
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

const isoDate = z.iso.date();
const text = (max: number) => z.string().trim().max(max);

const assessmentSchema = z.object({
  topics: z
    .array(
      z.object({
        area: z.number().int().min(1).max(11).nullable(),
        strengths: text(3000),
        weaknesses: text(3000),
        recommendations: text(3000),
      }),
    )
    .max(3),
  overall: text(3000),
});

export const ratingSchema = z.enum(["done", "partial", "not"]);

export const visitInputSchema = z.object({
  date: isoDate,
  form: z.enum(["onsite", "online", "phone"]),
  participantIds: z.array(z.string().min(1).max(64)).max(40).default([]),
  participants: text(500).default(""),
  /** kept for visits recorded before the mentoring cycle; new visits use `assessment` */
  summary: text(5000).default(""),
  topics: z.array(z.number().int().min(1).max(11)).max(3).default([]),
  assessment: assessmentSchema.nullable().default(null),
  prepTask: z
    .object({ text: text(1000).min(1), dueDate: isoDate.nullable().default(null) })
    .nullable()
    .default(null),
  findings: z
    .array(z.object({ area: z.number().int().min(1).max(11), text: text(2000).min(1) }))
    .max(11),
  actions: z
    .array(
      z.object({
        /** id of an existing action (keeps its done state); omitted for a new one */
        id: z.string().max(64).optional(),
        text: text(500).min(1),
        area: z.number().int().min(1).max(11).nullable(),
        owner: text(120).min(1),
        ownerId: z.string().min(1).max(64).nullable().default(null),
        dueDate: isoDate.nullable(),
      }),
    )
    .max(30),
});

/** what callers send (defaults may be omitted) */
export type VisitInput = z.input<typeof visitInputSchema>;
type ParsedVisitInput = z.output<typeof visitInputSchema>;

/**
 * Pure: validated content of a visit; actions keep id, done state and rating when they already
 * existed, the task before the visit keeps whether the club did it and its rating.
 */
export function buildVisitContent(
  input: ParsedVisitInput,
  previous: { actions: readonly MentorVisitAction[]; prepTask?: MentorPrepTask | null },
  newId: () => string = randomUUID,
): Pick<
  MentorVisitDoc,
  | "date"
  | "season"
  | "form"
  | "participantIds"
  | "participants"
  | "summary"
  | "topics"
  | "assessment"
  | "prepTask"
  | "findings"
  | "actions"
> {
  const areas = input.findings.map((f) => f.area);
  if (new Set(areas).size !== areas.length) {
    throw new ApiError("BAD_REQUEST", "One finding per area");
  }
  const topics = [...new Set(input.topics)].sort((a, b) => a - b);
  return {
    date: input.date,
    season: currentSeason(new Date(`${input.date}T12:00:00Z`)),
    form: input.form,
    participantIds: [...new Set(input.participantIds)],
    participants: input.participants,
    summary: input.summary,
    topics,
    assessment: input.assessment ? assessmentForTopics(input.assessment, topics) : null,
    prepTask: input.prepTask
      ? {
          text: input.prepTask.text,
          dueDate: input.prepTask.dueDate,
          done: previous.prepTask?.done ?? false,
          doneAt: previous.prepTask?.doneAt ?? null,
          doneBy: previous.prepTask?.doneBy ?? null,
          rating: previous.prepTask?.rating ?? null,
        }
      : null,
    findings: [...input.findings].sort((a, b) => a.area - b.area),
    actions: input.actions.map((a) => {
      const before = a.id ? previous.actions.find((p) => p.id === a.id) : undefined;
      return {
        id: before?.id ?? newId(),
        text: a.text,
        area: a.area,
        owner: a.owner,
        ownerId: a.ownerId ?? null,
        dueDate: a.dueDate,
        done: before?.done ?? false,
        doneAt: before?.doneAt ?? null,
        doneBy: before?.doneBy ?? null,
        rating: before?.rating ?? null,
      };
    }),
  };
}

/**
 * Pure: the assessment follows the topics (decision 22. 10. 2026) – one block per topic in the
 * topics' order, or one general block when the visit has no topic; blocks of other areas are
 * refused, empty ones dropped; null when nothing is written at all.
 */
export function assessmentForTopics(
  assessment: MentorAssessment,
  topics: readonly number[],
): MentorAssessment | null {
  const allowed: (number | null)[] = topics.length > 0 ? [...topics] : [null];
  if (assessment.topics.some((b) => !allowed.includes(b.area))) {
    throw new ApiError("BAD_REQUEST", "Assessment block does not match the topics");
  }
  const areas = assessment.topics.map((b) => b.area);
  if (new Set(areas).size !== areas.length) {
    throw new ApiError("BAD_REQUEST", "One assessment block per topic");
  }
  const filled = (b: MentorAssessment["topics"][number]) =>
    Boolean(b.strengths.trim() || b.weaknesses.trim() || b.recommendations.trim());
  const blocks = allowed
    .map((area) => assessment.topics.find((b) => b.area === area))
    .filter((b): b is MentorAssessment["topics"][number] => b !== undefined && filled(b));
  if (blocks.length === 0 && !assessment.overall.trim()) return null;
  return { topics: blocks, overall: assessment.overall };
}

export interface VisitList {
  clubId: string;
  access: VisitAccess;
  visits: StoredVisit[];
  /** names of the club's people, to show who was present */
  members: { userId: string; name: string; roles: string[] }[];
}

export async function listMentorVisits(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<VisitList> {
  const user = requireUser(actor);
  const access = await accessFor(deps, user, clubId);
  await requireClub(deps, clubId);
  const visits = (await deps.visits.listVisits(clubId))
    .filter((v) => visibleTo(access, v))
    .sort((a, b) => b.date.localeCompare(a.date) || +b.createdAt - +a.createdAt);
  return { clubId, access, visits, members: await clubMembers(deps, clubId) };
}

async function loadVisit(
  deps: MentorVisitDeps,
  user: CurrentUser,
  clubId: string,
  visitId: string,
) {
  const access = await accessFor(deps, user, clubId);
  const visit = await deps.visits.findVisit(clubId, visitId);
  if (!visit || !visibleTo(access, visit)) throw new ApiError("NOT_FOUND", "Visit not found");
  return { access, visit };
}

export async function getMentorVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
): Promise<StoredVisit> {
  return (await loadVisit(deps, requireUser(actor), clubId, visitId)).visit;
}

export async function createMentorVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<StoredVisit> {
  const user = requireUser(actor);
  if ((await accessFor(deps, user, clubId)) !== "write") {
    throw new ApiError("FORBIDDEN", "Only the club's mentor or admin_sfz can record a visit");
  }
  await requireClub(deps, clubId);
  const now = deps.now?.() ?? new Date();
  const { planned } = z.object({ planned: z.boolean().default(false) }).parse(input ?? {});
  const content = buildVisitContent(visitInputSchema.parse(input), { actions: [] });
  await requireMembers(deps, clubId, [
    ...content.participantIds,
    ...content.actions.flatMap((a) => (a.ownerId ? [a.ownerId] : [])),
  ]);
  return deps.visits.insertVisit({
    clubId,
    ...content,
    // planned: the club sees the date, topics and the task before the visit (MC)
    status: planned ? "planned" : "draft",
    sentAt: null,
    withdrawnAt: null,
    withdrawnBy: null,
    version: 1,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
    updatedBy: user.id,
  });
}

const versioned = z.object({ expectedVersion: z.number().int().positive() });

async function writeVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  expectedVersion: number,
  change: (
    visit: StoredVisit,
    user: CurrentUser,
    now: Date,
  ) => Parameters<MentorVisitStore["updateVisit"]>[3],
): Promise<StoredVisit> {
  const user = requireUser(actor);
  const { access, visit } = await loadVisit(deps, user, clubId, visitId);
  if (access !== "write") {
    throw new ApiError("FORBIDDEN", "Only the club's mentor or admin_sfz can change a visit");
  }
  if (visit.status === "withdrawn") throw new ApiError("CONFLICT", "Visit was withdrawn");
  if (visit.version !== expectedVersion) {
    throw new ApiError("CONFLICT", "Visit was changed by someone else");
  }
  const now = deps.now?.() ?? new Date();
  const updated = await deps.visits.updateVisit(clubId, visitId, expectedVersion, {
    ...change(visit, user, now),
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Visit was changed by someone else");
  return updated;
}

/** Edit the content of a draft or a sent visit (the club sees the corrected version). */
export async function updateMentorVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  input: unknown,
): Promise<StoredVisit> {
  const data = visitInputSchema.merge(versioned).parse(input);
  await requireMembers(deps, clubId, [
    ...new Set([
      ...data.participantIds,
      ...data.actions.flatMap((a) => (a.ownerId ? [a.ownerId] : [])),
    ]),
  ]);
  return writeVisit(deps, actor, clubId, visitId, data.expectedVersion, (visit) =>
    buildVisitContent(data, visit),
  );
}

/** Send a draft or a planned visit to the club: its record and agreed steps count from now on. */
export async function sendMentorVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  input: unknown,
): Promise<StoredVisit> {
  const { expectedVersion } = versioned.parse(input);
  return writeVisit(deps, actor, clubId, visitId, expectedVersion, (visit, _user, now) => {
    if (visit.status !== "draft" && visit.status !== "planned") {
      throw new ApiError("CONFLICT", "Visit was already sent");
    }
    return { status: "sent", sentAt: now };
  });
}

/** Withdraw a visit recorded by mistake; it stays in the history, the club no longer sees it. */
export async function withdrawMentorVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  input: unknown,
): Promise<StoredVisit> {
  const { expectedVersion } = versioned.parse(input);
  return writeVisit(deps, actor, clubId, visitId, expectedVersion, (_visit, user, now) => ({
    status: "withdrawn",
    withdrawnAt: now,
    withdrawnBy: user.id,
  }));
}

/** Tick an agreed action as done (or not) – the club, its mentor and admin_sfz; sent visits only. */
export async function setVisitActionDone(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  actionId: string,
  input: unknown,
): Promise<StoredVisit> {
  const user = requireUser(actor);
  const data = versioned.extend({ done: z.boolean() }).parse(input);
  const { visit } = await loadVisit(deps, user, clubId, visitId);
  if (visit.status !== "sent") throw new ApiError("CONFLICT", "Only actions of a sent visit");
  if (visit.version !== data.expectedVersion) {
    throw new ApiError("CONFLICT", "Visit was changed by someone else");
  }
  if (!visit.actions.some((a) => a.id === actionId)) {
    throw new ApiError("NOT_FOUND", "Action not found");
  }
  const now = deps.now?.() ?? new Date();
  const actions = visit.actions.map((a) =>
    a.id === actionId
      ? {
          ...a,
          done: data.done,
          doneAt: data.done ? (a.done ? a.doneAt : now) : null,
          doneBy: data.done ? (a.done ? a.doneBy : user.id) : null,
        }
      : a,
  );
  const updated = await deps.visits.updateVisit(clubId, visitId, data.expectedVersion, {
    actions,
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Visit was changed by someone else");
  return updated;
}

/** The club ticks the task before the visit as prepared (or not) – planned and sent visits (MC). */
export async function setPrepTaskDone(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  input: unknown,
): Promise<StoredVisit> {
  const user = requireUser(actor);
  const data = versioned.extend({ done: z.boolean() }).parse(input);
  const { visit } = await loadVisit(deps, user, clubId, visitId);
  if (visit.status !== "planned" && visit.status !== "sent") {
    throw new ApiError("CONFLICT", "Only a planned or sent visit");
  }
  if (!visit.prepTask) throw new ApiError("NOT_FOUND", "The visit has no task before it");
  if (visit.version !== data.expectedVersion) {
    throw new ApiError("CONFLICT", "Visit was changed by someone else");
  }
  const now = deps.now?.() ?? new Date();
  const before = visit.prepTask;
  const updated = await deps.visits.updateVisit(clubId, visitId, data.expectedVersion, {
    prepTask: {
      ...before,
      done: data.done,
      doneAt: data.done ? (before.done ? before.doneAt : now) : null,
      doneBy: data.done ? (before.done ? before.doneBy : user.id) : null,
    },
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Visit was changed by someone else");
  return updated;
}

export const rateVisitSchema = versioned.extend({
  /** rating of the task before the visit; omitted = unchanged, null = clear */
  prep: ratingSchema.nullable().optional(),
  actions: z
    .array(z.object({ id: z.string().min(1).max(64), rating: ratingSchema.nullable() }))
    .max(30)
    .default([]),
});

/** Pure: applies the mentor's ratings; an unknown action is an error (no silent typos). */
export function applyRatings(
  visit: Pick<StoredVisit, "prepTask" | "actions">,
  ratings: { prep?: MentorRating | null; actions: { id: string; rating: MentorRating | null }[] },
): Pick<StoredVisit, "prepTask" | "actions"> {
  if (ratings.prep !== undefined && !visit.prepTask) {
    throw new ApiError("BAD_REQUEST", "The visit has no task before it");
  }
  const byId = new Map(ratings.actions.map((r) => [r.id, r.rating]));
  if ([...byId.keys()].some((id) => !visit.actions.some((a) => a.id === id))) {
    throw new ApiError("NOT_FOUND", "Action not found");
  }
  return {
    prepTask:
      visit.prepTask && ratings.prep !== undefined
        ? { ...visit.prepTask, rating: ratings.prep }
        : visit.prepTask,
    actions: visit.actions.map((a) => (byId.has(a.id) ? { ...a, rating: byId.get(a.id)! } : a)),
  };
}

/**
 * The mentor rates how the task before the visit and the agreed steps turned out: done, partly,
 * not done (MC, like "úloha vopred / po – hodnotenie" in the EYA mentoring).
 */
export async function rateMentorVisit(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
  visitId: string,
  input: unknown,
): Promise<StoredVisit> {
  const data = rateVisitSchema.parse(input);
  return writeVisit(deps, actor, clubId, visitId, data.expectedVersion, (visit) =>
    applyRatings(visit, data),
  );
}

export interface VisitFormData {
  clubId: string;
  season: string;
  members: { userId: string; name: string; roles: string[] }[];
  /** the latest sent visit: when, how many actions are done, which are open */
  previous: {
    id: string;
    date: string;
    done: number;
    total: number;
    open: MentorVisitAction[];
  } | null;
  /** the 3 weakest areas of the latest submitted Kompas (mentors see only submitted ones) */
  weakest: { area: number; points: number }[];
  /** goals of the season's plan (CP-b) */
  planGoals: { area: number; title: string; status: string }[];
}

/** Data the mentor's form needs: who can be ticked as present, the last visit and weak areas. */
export async function getVisitFormData(
  deps: MentorVisitDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<VisitFormData> {
  const user = requireUser(actor);
  if ((await accessFor(deps, user, clubId)) !== "write") {
    throw new ApiError("FORBIDDEN", "Only the club's mentor or admin_sfz can record a visit");
  }
  await requireClub(deps, clubId);
  const season = currentSeason(deps.now?.() ?? new Date());
  const [members, visits, submissions, plan] = await Promise.all([
    clubMembers(deps, clubId),
    deps.visits.listVisits(clubId),
    deps.submissions.listSubmissions(clubId, season),
    deps.plans?.findPlan(clubId, season) ?? null,
  ]);
  const last = visits
    .filter((v) => v.status === "sent")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const latest = submissions
    .filter(isValidSubmission)
    .sort((a, b) => +b.submittedAt - +a.submittedAt)[0];
  const result = latest ? (latest.result as unknown as KompasResult) : null;
  return {
    clubId,
    season,
    members,
    previous: last
      ? {
          id: last.id,
          date: last.date,
          done: last.actions.filter((a) => a.done).length,
          total: last.actions.length,
          open: last.actions.filter((a) => !a.done),
        }
      : null,
    weakest: (result?.next ?? []).map((n) => ({ area: n.area, points: n.points })),
    planGoals: (plan?.goals ?? []).map((g) => ({ area: g.area, title: g.title, status: g.status })),
  };
}
