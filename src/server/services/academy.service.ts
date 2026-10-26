import { z } from "zod";

import { milestonesOf, type Milestone } from "@/lib/rankings";

import { ApiError } from "@/server/api/errors";
import type { AreaRoleChoiceDoc, ClubRole, PlanGoalStatus } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubSettingsStore } from "@/server/services/club-settings.service";
import type { ContentStore } from "@/server/services/content.service";
import { profileFromSeason } from "@/server/services/kompas-export";
import type { KompasResult } from "@/server/services/kompas-scoring";
import {
  isValidSubmission,
  listMentorClubs,
  type MentorClubRow,
  type SubmissionDeps,
} from "@/server/services/kompas-submission.service";
import { kompasAreas } from "@/server/services/analytics.service";
import {
  closingDue,
  mentoringStatus,
  type MentoringStatus,
  type MentoringStore,
} from "@/server/services/club-mentoring.service";
import { getKompas } from "@/server/services/kompas.service";
import type {
  EvaluationStore,
  LicensingSubmissionStore,
} from "@/server/services/licensing.service";
import {
  summarizeProgress,
  type PracticeProgressStore,
} from "@/server/services/practice-progress.service";
import { getPractice, type PracticeStore } from "@/server/services/practice.service";
import {
  planTasksFor,
  summarizePlan,
  type PlanStore,
  type PlanTask,
} from "@/server/services/club-plan.service";
import {
  isoToday,
  summarizeVisits,
  visitTasksFor,
  type MentorVisitStore,
  type VisitSummary,
  type VisitTask,
} from "@/server/services/mentor-visit.service";
import type { PracticeContent } from "@/server/services/practice.schema";
import type { RoleCatalog } from "@/server/services/role-catalog.schema";
import { getRoleCatalog, type RoleCatalogStore } from "@/server/services/role-catalog.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Moja Akadémia (F6b, ADR 0010): a dashboard per club and role of the signed-in user.
 * Tasks are derived from data (Kompas, licensing evaluation, Sportnet snapshot), never typed in.
 * The user may pick their own roles in the areas (role catalog); they steer the default Prax role.
 * Every club query is scoped by clubId (ADR 0003).
 */
export interface AreaRoleChoiceStore {
  findChoice: (userId: string, clubId: string, season: string) => Promise<AreaRoleChoiceDoc | null>;
  saveChoice: (doc: AreaRoleChoiceDoc) => Promise<AreaRoleChoiceDoc>;
}

export interface AcademyDeps extends SubmissionDeps {
  content: Pick<ContentStore, "listQuestions" | "listAreas">;
  evaluations: Pick<EvaluationStore, "findEvaluation">;
  licensingSubmissions: Pick<LicensingSubmissionStore, "findSubmission">;
  roleCatalog: Pick<RoleCatalogStore, "findCatalog">;
  choices: AreaRoleChoiceStore;
  practice: Pick<PracticeStore, "findPractice" | "listPracticeAreas">;
  visits: Pick<MentorVisitStore, "listVisits">;
  plans: Pick<PlanStore, "findPlan">;
  progress: Pick<PracticeProgressStore, "findProgress">;
  /** the club's mentoring cycle (MC-d); absent in older test setups */
  mentoring?: Pick<MentoringStore, "findMentoring">;
  /** the club's settings – consent to the rankings (MR-c); absent in older test setups */
  settings?: Pick<ClubSettingsStore, "findSettings">;
}

export type TaskSeverity = "crit" | "warn" | "info";

export interface AcademyTask {
  key:
    | "kompas_empty"
    | "kompas_unsent"
    | "ranking_consent"
    | "club_kompas_unconfirmed"
    | "licensing_open"
    | "teams_without_coach"
    | "weak_area"
    | "club_kompas_missing"
    | "club_licensing_open"
    | "practice_first"
    | "practice_next"
    | "visit_action"
    | "club_no_visit"
    | "plan_goal"
    | "plan_missing"
    | "club_no_plan"
    | "mentoring_intro"
    | "mentoring_prep"
    | "mentoring_closing"
    | "club_no_focus"
    | "club_no_closing";
  severity: TaskSeverity;
  /** relative link inside the app */
  href: string;
  area?: number;
  points?: number;
  count?: number;
  clubName?: string;
  /** Prax: the step to continue with (label and title) */
  step?: string;
  /** Prax progress of the user's role in the area (weak areas, F6d) */
  practice?: { stepsDone: number; stepsTotal: number };
  /** agreed action of a mentor visit: due date (ISO) and whether it is overdue (MV-c) */
  due?: { date: string | null; overdue: boolean };
}

/** Prax progress of the user's role in one area of a club (F6d). */
export interface PracticeTaskInput {
  area: number;
  roleId: string;
  firstStepTitle: string;
  tasksDone: number;
  tasksTotal: number;
  stepsDone: number;
  stepsTotal: number;
  next: { label: string; title: string } | null;
}

export interface TaskInput {
  clubId: string;
  roles: ClubRole[];
  kompasVersion: number;
  kompasResult: Pick<KompasResult, "filledAreas" | "next" | "areas">;
  /** working version changed after the last valid submission (or nothing submitted) */
  kompasUnsent: boolean;
  licensingClosed: boolean;
  teamsWithoutCoach: number;
  /** Prax progress per area with practice (F6d) */
  practice?: PracticeTaskInput[];
  /** open agreed actions of mentor visits the user should see (MV-c) */
  visitTasks?: VisitTask[];
  /** goals of the season's plan due soon or overdue (CP-b) */
  planTasks?: PlanTask[];
  /** the club has a Kompas but no plan for the season yet (management) */
  planMissing?: boolean;
  /** management has not decided on the public rankings yet (MR-c, ADR 0015) */
  rankingUndecided?: boolean;
  /** the club's mentoring cycle (MC-d): only when the club has a mentor this season */
  mentoring?: {
    status: MentoringStatus;
    closingDue: boolean;
    /** the next planned meeting whose task before it the club has not ticked yet */
    prep: { visitId: string; text: string; dueDate: string | null; overdue: boolean } | null;
  } | null;
}

const ORDER: Record<TaskSeverity, number> = { crit: 0, warn: 1, info: 2 };

/** Pure: tasks for management and coach in one club, most urgent first. */
export function clubTasks(i: TaskInput): AcademyTask[] {
  const base = `/klub/${encodeURIComponent(i.clubId)}`;
  const tasks: AcademyTask[] = [];
  const management = i.roles.includes("management");
  const coach = i.roles.includes("coach");
  if (management) {
    if (i.kompasVersion === 0 || i.kompasResult.filledAreas === 0) {
      tasks.push({ key: "kompas_empty", severity: "crit", href: `${base}/kompas` });
    } else if (i.kompasUnsent) {
      tasks.push({ key: "kompas_unsent", severity: "warn", href: `${base}/kompas` });
    }
    if (!i.licensingClosed) {
      tasks.push({ key: "licensing_open", severity: "warn", href: `${base}/licencne-hodnotenie` });
    }
  }
  if ((management || coach) && i.teamsWithoutCoach > 0) {
    tasks.push({
      key: "teams_without_coach",
      severity: management ? "warn" : "info",
      href: base,
      count: i.teamsWithoutCoach,
    });
  }
  // weakest areas → Prax; coaches look at their areas 3 (coaches) and 5 (player)
  const weak = management
    ? i.kompasResult.next.map((n) => ({ area: n.area, points: n.points }))
    : coach
      ? i.kompasResult.areas
          .filter((a) => (a.area === 3 || a.area === 5) && a.points !== null)
          .sort((a, b) => a.points! - b.points!)
          .slice(0, 1)
          .map((a) => ({ area: a.area, points: a.points! }))
      : [];
  const practice = new Map((i.practice ?? []).map((p) => [p.area, p]));
  const praxHref = (p: PracticeTaskInput) =>
    `/oblasti/${p.area}?tab=prax&role=${encodeURIComponent(p.roleId)}&club=${encodeURIComponent(i.clubId)}`;
  // started Prax that is not finished: continue with the first step, then the next step of the path
  for (const p of practice.values()) {
    const started = p.tasksDone + p.stepsDone > 0;
    if (!started) continue;
    if (p.tasksDone < p.tasksTotal) {
      tasks.push({
        key: "practice_first",
        severity: "info",
        href: praxHref(p),
        area: p.area,
        step: p.firstStepTitle,
      });
    } else if (p.next) {
      tasks.push({
        key: "practice_next",
        severity: "info",
        href: praxHref(p),
        area: p.area,
        step: `${p.next.label}: ${p.next.title}`,
      });
    }
  }
  for (const w of weak) {
    const p = practice.get(w.area);
    tasks.push({
      key: "weak_area",
      severity: "info",
      href: p ? praxHref(p) : `/oblasti/${w.area}?tab=prax`,
      area: w.area,
      points: w.points,
      ...(p ? { practice: { stepsDone: p.stepsDone, stepsTotal: p.stepsTotal } } : {}),
    });
  }
  if (management && i.rankingUndecided) {
    tasks.push({ key: "ranking_consent", severity: "info", href: `${base}/vizitka#rebricek` });
  }
  const planHref = `/klub/${encodeURIComponent(i.clubId)}/plan`;
  if (i.planMissing && i.roles.includes("management")) {
    tasks.push({ key: "plan_missing", severity: "info", href: planHref });
  }
  for (const g of i.planTasks ?? []) {
    tasks.push({
      key: "plan_goal",
      severity: g.overdue ? "crit" : "warn",
      href: planHref,
      area: g.area,
      step: g.title,
      due: { date: g.dueDate, overdue: g.overdue },
    });
  }
  // the mentoring cycle (MC-d): opening, preparing for a meeting, closing – management only
  const m = i.mentoring;
  if (m && management) {
    const mentoringHref = `/klub/${encodeURIComponent(i.clubId)}/mentoring`;
    if (!m.status.intro) {
      tasks.push({ key: "mentoring_intro", severity: "warn", href: mentoringHref });
    }
    if (m.prep) {
      tasks.push({
        key: "mentoring_prep",
        severity: m.prep.overdue ? "crit" : "warn",
        href: `/klub/${encodeURIComponent(i.clubId)}/navstevy/${m.prep.visitId}`,
        step: m.prep.text,
        due: { date: m.prep.dueDate, overdue: m.prep.overdue },
      });
    }
    if (m.closingDue && !m.status.closingClub) {
      tasks.push({ key: "mentoring_closing", severity: "info", href: mentoringHref });
    }
  }
  // agreed with the mentor: overdue ones are urgent (decision 21. 10. 2026)
  for (const v of i.visitTasks ?? []) {
    tasks.push({
      key: "visit_action",
      severity: v.overdue ? "crit" : "warn",
      href: `/klub/${encodeURIComponent(i.clubId)}/navstevy/${v.visitId}`,
      step: v.text,
      due: { date: v.dueDate, overdue: v.overdue },
    });
  }
  return tasks.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

/** Pure: home screen split (H5b) – up to `limit` tasks to do; weak areas and Prax steps (F6d) apart. */
export function splitTasks(
  tasks: readonly AcademyTask[],
  limit = 3,
): { todo: AcademyTask[]; more: number; weak: AcademyTask[]; practice: AcademyTask[] } {
  const isPractice = (t: AcademyTask) => t.key === "practice_first" || t.key === "practice_next";
  const todo = tasks.filter((t) => t.key !== "weak_area" && !isPractice(t));
  return {
    todo: todo.slice(0, limit),
    more: Math.max(0, todo.length - limit),
    weak: tasks.filter((t) => t.key === "weak_area"),
    practice: tasks.filter(isPractice),
  };
}

/** Pure: tasks of a mentor over the clubs of the cohort, one summary task per kind. */
export function mentorTasks(
  rows: (Pick<MentorClubRow, "clubId" | "name" | "latest"> & {
    licensingClosed: boolean;
    visits?: VisitSummary;
    plan?: PlanSummary;
    mentoring?: MentoringStatus;
  })[],
  opts: { closingDue?: boolean } = {},
): AcademyTask[] {
  const noFocus = rows.filter((r) => r.mentoring && !r.mentoring.focus).map((r) => r.name);
  const noClosing = opts.closingDue
    ? rows.filter((r) => r.mentoring && !r.mentoring.closingMentor).map((r) => r.name)
    : [];
  const missing = rows.filter((r) => !r.latest).map((r) => r.name);
  // the latest Kompas of the season waits for the mentor's confirmation (MR-c, ADR 0015)
  const unconfirmed = rows.filter((r) => r.latest && !r.latest.confirmedAt).map((r) => r.name);
  const unvisited = rows.filter((r) => r.visits && !r.visits.lastDate).map((r) => r.name);
  const unplanned = rows.filter((r) => r.plan && r.plan.goals === 0).map((r) => r.name);
  const open = rows.filter((r) => !r.licensingClosed).map((r) => r.name);
  const tasks: AcademyTask[] = [];
  if (missing.length > 0) {
    tasks.push({
      key: "club_kompas_missing",
      severity: "crit",
      href: "#mentor-clubs",
      count: missing.length,
      clubName: missing.join(", "),
    });
  }
  if (unconfirmed.length > 0) {
    tasks.push({
      key: "club_kompas_unconfirmed",
      severity: "warn",
      href: "#mentor-clubs",
      count: unconfirmed.length,
      clubName: unconfirmed.join(", "),
    });
  }
  if (open.length > 0) {
    tasks.push({
      key: "club_licensing_open",
      severity: "warn",
      href: "#mentor-clubs",
      count: open.length,
      clubName: open.join(", "),
    });
  }
  if (unplanned.length > 0) {
    tasks.push({
      key: "club_no_plan",
      severity: "info",
      href: "#mentor-clubs",
      count: unplanned.length,
      clubName: unplanned.join(", "),
    });
  }
  if (unvisited.length > 0) {
    tasks.push({
      key: "club_no_visit",
      severity: "info",
      href: "#mentor-clubs",
      count: unvisited.length,
      clubName: unvisited.join(", "),
    });
  }
  if (noFocus.length > 0) {
    tasks.push({
      key: "club_no_focus",
      severity: "info",
      href: "#mentor-clubs",
      count: noFocus.length,
      clubName: noFocus.join(", "),
    });
  }
  if (noClosing.length > 0) {
    tasks.push({
      key: "club_no_closing",
      severity: "warn",
      href: "#mentor-clubs",
      count: noClosing.length,
      clubName: noClosing.join(", "),
    });
  }
  return tasks;
}

/** Pure: Prax role of an area from the user's own roles in the areas ("area.key"), if any. */
export function practiceRoleFromChoice(
  catalog: RoleCatalog,
  chosen: readonly string[],
  area: number,
): string | null {
  const areaRoles = catalog.areas.find((a) => a.area === area)?.roles ?? [];
  return (
    chosen
      .filter((r) => r.startsWith(`${area}.`))
      .map((r) => areaRoles.find((x) => x.key === r.slice(String(area).length + 1)))
      .find((r) => r?.practiceRole)?.practiceRole ?? null
  );
}

/** Prax roles of the pilot club roles (ADR 0004); mentors only read. */
const CLUB_PRACTICE_ROLE: Partial<Record<ClubRole, string>> = { management: "v", coach: "t" };

/** Pure: the user's Prax role and progress in one area of a club. */
export function practiceInput(
  area: number,
  content: Pick<PracticeContent, "roles">,
  progress: Parameters<typeof summarizeProgress>[1],
  roleId: string | null,
): PracticeTaskInput | null {
  const role = content.roles.find((r) => r.id === roleId);
  if (!role) return null;
  const summary = summarizeProgress(content, progress).find((r) => r.roleId === role.id)!;
  const next = role.steps.find((s) => s.id === summary.nextStepId);
  return {
    area,
    roleId: role.id,
    firstStepTitle: role.firstStep.title,
    tasksDone: summary.tasksDone,
    tasksTotal: summary.tasksTotal,
    stepsDone: summary.stepsDone,
    stepsTotal: summary.stepsTotal,
    next: next ? { label: next.label, title: next.title } : null,
  };
}

export interface AreaRoleOption {
  area: number;
  key: string;
  name: string;
  status: "approved" | "proposal";
}

/** Roles in the areas that belong to the given club roles (through base roles of the catalog). */
export function roleOptions(catalog: RoleCatalog, roles: readonly ClubRole[]): AreaRoleOption[] {
  const bases = new Set(
    catalog.baseRoles.filter((b) => b.clubRole && roles.includes(b.clubRole)).map((b) => b.key),
  );
  return catalog.areas.flatMap((a) =>
    a.roles
      .filter((r) => r.baseRoles.some((b) => bases.has(b)))
      .map((r) => ({ area: a.area, key: r.key, name: r.name, status: r.status ?? a.status })),
  );
}

/** how far a club plan is (mentor overview) */
export type PlanSummary = ReturnType<typeof summarizePlan>;

export interface AcademyClub {
  clubId: string;
  name: string;
  union: string;
  roles: ClubRole[];
  /** base role names of the catalog for the user's club roles */
  baseRoleNames: string[];
  kompas: {
    version: number;
    total: number;
    filledAreas: number;
    submittedAt: Date | null;
    /** points of areas 1–11 (index 0 = area 1), null when not scored – dashboard chart */
    areas: (number | null)[];
  } | null;
  licensingClosedAt: Date | null;
  /** mentor visits of the season (dashboard tile) */
  visits: VisitSummary;
  /** plan of the season (dashboard tile) */
  plan: PlanSummary;
  planGoals: {
    id: string;
    area: number;
    title: string;
    status: PlanGoalStatus;
    dueDate: string | null;
  }[];
  tasks: AcademyTask[];
  /** the season's mentoring cycle; null when the club has no mentor this season (MC-d) */
  mentoring: (MentoringStatus & { nextPlanned: string | null }) | null;
  /** milestones of the season (MR-c, ADR 0015) – the club sees them whatever its consent */
  milestones: Milestone[];
  /** consent to the public rankings: null = not decided yet */
  rankingConsent: boolean | null;
  /** chosen roles as "area.key" */
  chosenRoles: string[];
  roleOptions: AreaRoleOption[];
}

export interface AcademyView {
  season: string;
  clubs: AcademyClub[];
  /** clubs of the mentor's cohort; null when the user is no mentor */
  mentor: {
    rows: (MentorClubRow & {
      licensingClosed: boolean;
      visits: VisitSummary;
      plan: PlanSummary;
      mentoring: MentoringStatus;
    })[];
    tasks: AcademyTask[];
  } | null;
  /** admin_sfz: all pilot clubs with the latest Kompas and visits (dashboard tiles) */
  admin: {
    rows: (MentorClubRow & { visits: VisitSummary; mentoring: MentoringStatus })[];
  } | null;
}

export async function getMyAcademy(
  deps: AcademyDeps,
  actor: CurrentUser | null,
): Promise<AcademyView> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const now = deps.now?.() ?? new Date();
  const today = isoToday(now);
  const memberships = await deps.memberships.listByUser(user.id);
  const catalogDto = await getRoleCatalog(deps.roleCatalog, user);
  const catalog = catalogDto?.content ?? null;

  const clubIds = [...new Set(memberships.filter((m) => m.season === season).map((m) => m.clubId))];
  const clubs = (await deps.clubs.listClubs(clubIds)).sort((a, b) =>
    a.name.localeCompare(b.name, "sk"),
  );
  const practices = (
    await Promise.all(
      (await deps.practice.listPracticeAreas()).map(async (area) => ({
        area,
        content: (await getPractice(deps.practice, user, area))?.content ?? null,
      })),
    )
  ).filter((p): p is { area: number; content: PracticeContent } => p.content !== null);

  const own: AcademyClub[] = [];
  for (const club of clubs) {
    const roles: ClubRole[] = clubRolesFor(memberships, club.clubId, season).filter(
      (r) => r !== "mentor",
    );
    if (roles.length === 0) continue;
    const [view, subs, closed, seasonData, choice] = await Promise.all([
      getKompas(deps, user, club.clubId),
      deps.submissions.listSubmissions(club.clubId, season),
      deps.licensingSubmissions.findSubmission(club.clubId, season),
      deps.clubs.findSeason(club.clubId, season),
      deps.choices.findChoice(user.id, club.clubId, season),
    ]);
    const latest =
      subs.filter(isValidSubmission).sort((a, b) => +b.submittedAt - +a.submittedAt)[0] ?? null;
    const practice = (
      await Promise.all(
        practices.map(async ({ area, content }) => {
          const roleId =
            (catalog ? practiceRoleFromChoice(catalog, choice?.roles ?? [], area) : null) ??
            roles
              .map((r) => CLUB_PRACTICE_ROLE[r])
              .find((id) => content.roles.some((x) => x.id === id)) ??
            null;
          const progress = await deps.progress.findProgress(club.clubId, season, area);
          return practiceInput(area, content, progress, roleId);
        }),
      )
    ).filter((p): p is PracticeTaskInput => p !== null);
    const unsent = !latest || (view.updatedAt !== null && +view.updatedAt > +latest.submittedAt);
    const plan = await deps.plans.findPlan(club.clubId, season);
    const visits = await deps.visits.listVisits(club.clubId);
    const settings = (await deps.settings?.findSettings(club.clubId)) ?? null;
    const hasMentor = (await deps.memberships.listByClub(club.clubId, season)).some(
      (m) => m.role === "mentor",
    );
    const mentoringDoc = hasMentor
      ? ((await deps.mentoring?.findMentoring(club.clubId, season)) ?? null)
      : null;
    const prepVisit = visits
      .filter(
        (v) =>
          v.status === "planned" &&
          v.season === season &&
          v.date >= today &&
          v.prepTask &&
          !v.prepTask.done,
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const planTasks = planTasksFor(
      plan,
      { userId: user.id, management: roles.includes("management") },
      today,
    );
    const visitTasks = visitTasksFor(
      visits,
      { userId: user.id, management: roles.includes("management") },
      today,
    );
    own.push({
      clubId: club.clubId,
      name: club.name,
      union: club.union,
      roles,
      baseRoleNames: catalog
        ? catalog.baseRoles
            .filter((b) => b.clubRole && roles.includes(b.clubRole))
            .map((b) => b.name)
        : [],
      kompas: {
        version: view.version,
        total: view.result.total,
        filledAreas: view.result.filledAreas,
        submittedAt: latest?.submittedAt ?? null,
        areas: kompasAreas(view.result),
      },
      licensingClosedAt: closed?.closedAt ?? null,
      visits: summarizeVisits(visits, season, today),
      plan: summarizePlan(plan),
      mentoring: hasMentor
        ? {
            ...mentoringStatus(mentoringDoc),
            nextPlanned: summarizeVisits(visits, season, today).nextPlanned,
          }
        : null,
      milestones: milestonesOf({
        kompas: latest !== null,
        confirmed: Boolean(latest?.confirmedAt),
        goals: plan?.goals ?? null,
        sentVisit: visits.some((v) => v.season === season && v.status === "sent"),
        licensing: closed !== null,
      }),
      rankingConsent: settings?.rankingConsent?.given ?? null,
      planGoals: (plan?.goals ?? []).map((g) => ({
        id: g.id,
        area: g.area,
        title: g.title,
        status: g.status,
        dueDate: g.dueDate,
      })),
      tasks: clubTasks({
        clubId: club.clubId,
        roles,
        kompasVersion: view.version,
        kompasResult: view.result,
        kompasUnsent: unsent,
        licensingClosed: closed !== null,
        teamsWithoutCoach: seasonData ? profileFromSeason(seasonData).teamsWithoutCoach : 0,
        practice,
        visitTasks,
        planTasks,
        planMissing: view.result.filledAreas > 0 && (plan?.goals.length ?? 0) === 0,
        rankingUndecided: deps.settings !== undefined && !settings?.rankingConsent,
        mentoring: hasMentor
          ? {
              status: mentoringStatus(mentoringDoc),
              closingDue: closingDue(now),
              prep: prepVisit?.prepTask
                ? {
                    visitId: prepVisit.id,
                    text: prepVisit.prepTask.text,
                    dueDate: prepVisit.prepTask.dueDate,
                    overdue:
                      prepVisit.prepTask.dueDate !== null && prepVisit.prepTask.dueDate < today,
                  }
                : null,
            }
          : null,
      }),
      chosenRoles: choice?.roles ?? [],
      roleOptions: catalog ? roleOptions(catalog, roles) : [],
    });
  }

  const isMentor = memberships.some((m) => m.season === season && m.role === "mentor");
  let mentor: AcademyView["mentor"] = null;
  if (isMentor) {
    const rows = await Promise.all(
      (await listMentorClubs(deps, user))
        .filter((r) => clubRolesFor(memberships, r.clubId, season).includes("mentor"))
        .map(async (r) => ({
          ...r,
          licensingClosed:
            (await deps.licensingSubmissions.findSubmission(r.clubId, season)) !== null,
          visits: summarizeVisits(await deps.visits.listVisits(r.clubId), season, today),
          plan: summarizePlan(await deps.plans.findPlan(r.clubId, season)),
          mentoring: mentoringStatus(
            (await deps.mentoring?.findMentoring(r.clubId, season)) ?? null,
          ),
        })),
    );
    mentor = { rows, tasks: mentorTasks(rows, { closingDue: closingDue(now) }) };
  }
  let admin: AcademyView["admin"] = null;
  if (isAdmin(user)) {
    const rows = await listMentorClubs(deps, user);
    admin = {
      rows: await Promise.all(
        rows.map(async (r) => ({
          ...r,
          visits: summarizeVisits(await deps.visits.listVisits(r.clubId), season, today),
          mentoring: mentoringStatus(
            (await deps.mentoring?.findMentoring(r.clubId, season)) ?? null,
          ),
        })),
      ),
    };
  }
  return { season, clubs: own, mentor, admin };
}

export const saveChoiceSchema = z.object({
  roles: z.array(z.string().regex(/^\d{1,2}\.[a-z][a-z0-9_]{1,40}$/)).max(80),
});

/** Saves the user's own roles in the areas for one club (only roles of their club roles). */
export async function saveAreaRoleChoice(
  deps: AcademyDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<string[]> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const roles: ClubRole[] = clubRolesFor(
    await deps.memberships.listByUser(user.id),
    clubId,
    season,
  ).filter((r) => r !== "mentor");
  if (roles.length === 0) throw new ApiError("FORBIDDEN", "No role in this club");
  const catalog = (await getRoleCatalog(deps.roleCatalog, user))?.content;
  if (!catalog) throw new ApiError("NOT_FOUND", "Role catalog not found");
  const allowed = new Set(roleOptions(catalog, roles).map((o) => `${o.area}.${o.key}`));
  const chosen = [...new Set(saveChoiceSchema.parse(input).roles)];
  if (chosen.some((c) => !allowed.has(c))) throw new ApiError("BAD_REQUEST", "Role not available");
  const saved = await deps.choices.saveChoice({
    userId: user.id,
    clubId,
    season,
    roles: chosen.sort(),
    updatedAt: deps.now?.() ?? new Date(),
  });
  return saved.roles;
}

/** Default Prax role of an area for the user: a chosen role with a practice role wins, then the club role. */
export async function practiceRoleFor(
  deps: Pick<AcademyDeps, "memberships" | "roleCatalog" | "choices" | "now">,
  user: CurrentUser,
  area: number,
): Promise<string | null> {
  const season = currentSeason(deps.now?.() ?? new Date());
  const catalog = (await getRoleCatalog(deps.roleCatalog, user))?.content;
  if (!catalog) return null;
  const memberships = await deps.memberships.listByUser(user.id);
  const clubIds = [...new Set(memberships.filter((m) => m.season === season).map((m) => m.clubId))];
  for (const clubId of clubIds) {
    const choice = await deps.choices.findChoice(user.id, clubId, season);
    const hit = practiceRoleFromChoice(catalog, choice?.roles ?? [], area);
    if (hit) return hit;
  }
  return null;
}
