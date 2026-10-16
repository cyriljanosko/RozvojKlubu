import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { AreaRoleChoiceDoc, ClubRole } from "@/server/db/types";
import { clubRolesFor } from "@/server/services/club-access";
import type { ContentStore } from "@/server/services/content.service";
import { profileFromSeason } from "@/server/services/kompas-export";
import type { KompasResult } from "@/server/services/kompas-scoring";
import {
  isValidSubmission,
  listMentorClubs,
  type MentorClubRow,
  type SubmissionDeps,
} from "@/server/services/kompas-submission.service";
import { getKompas } from "@/server/services/kompas.service";
import type {
  EvaluationStore,
  LicensingSubmissionStore,
} from "@/server/services/licensing.service";
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
}

export type TaskSeverity = "crit" | "warn" | "info";

export interface AcademyTask {
  key:
    | "kompas_empty"
    | "kompas_unsent"
    | "licensing_open"
    | "teams_without_coach"
    | "weak_area"
    | "club_kompas_missing"
    | "club_licensing_open";
  severity: TaskSeverity;
  /** relative link inside the app */
  href: string;
  area?: number;
  points?: number;
  count?: number;
  clubName?: string;
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
  for (const w of weak) {
    tasks.push({
      key: "weak_area",
      severity: "info",
      href: `/oblasti/${w.area}?tab=prax`,
      area: w.area,
      points: w.points,
    });
  }
  return tasks.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

/** Pure: tasks of a mentor over the clubs of the cohort, one summary task per kind. */
export function mentorTasks(
  rows: (Pick<MentorClubRow, "clubId" | "name" | "latest"> & { licensingClosed: boolean })[],
): AcademyTask[] {
  const missing = rows.filter((r) => !r.latest).map((r) => r.name);
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
  if (open.length > 0) {
    tasks.push({
      key: "club_licensing_open",
      severity: "warn",
      href: "#mentor-clubs",
      count: open.length,
      clubName: open.join(", "),
    });
  }
  return tasks;
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

export interface AcademyClub {
  clubId: string;
  name: string;
  union: string;
  roles: ClubRole[];
  /** base role names of the catalog for the user's club roles */
  baseRoleNames: string[];
  kompas: { version: number; total: number; filledAreas: number; submittedAt: Date | null } | null;
  licensingClosedAt: Date | null;
  tasks: AcademyTask[];
  /** chosen roles as "area.key" */
  chosenRoles: string[];
  roleOptions: AreaRoleOption[];
}

export interface AcademyView {
  season: string;
  clubs: AcademyClub[];
  /** clubs of the mentor's cohort; null when the user is no mentor */
  mentor: { rows: (MentorClubRow & { licensingClosed: boolean })[]; tasks: AcademyTask[] } | null;
}

export async function getMyAcademy(
  deps: AcademyDeps,
  actor: CurrentUser | null,
): Promise<AcademyView> {
  const user = requireUser(actor);
  const season = currentSeason(deps.now?.() ?? new Date());
  const memberships = await deps.memberships.listByUser(user.id);
  const catalogDto = await getRoleCatalog(deps.roleCatalog, user);
  const catalog = catalogDto?.content ?? null;

  const clubIds = [...new Set(memberships.filter((m) => m.season === season).map((m) => m.clubId))];
  const clubs = (await deps.clubs.listClubs(clubIds)).sort((a, b) =>
    a.name.localeCompare(b.name, "sk"),
  );

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
    const unsent = !latest || (view.updatedAt !== null && +view.updatedAt > +latest.submittedAt);
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
      },
      licensingClosedAt: closed?.closedAt ?? null,
      tasks: clubTasks({
        clubId: club.clubId,
        roles,
        kompasVersion: view.version,
        kompasResult: view.result,
        kompasUnsent: unsent,
        licensingClosed: closed !== null,
        teamsWithoutCoach: seasonData ? profileFromSeason(seasonData).teamsWithoutCoach : 0,
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
        })),
    );
    mentor = { rows, tasks: mentorTasks(rows) };
  }
  return { season, clubs: own, mentor };
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
  const areaRoles = catalog.areas.find((a) => a.area === area)?.roles ?? [];
  const memberships = await deps.memberships.listByUser(user.id);
  const clubIds = [...new Set(memberships.filter((m) => m.season === season).map((m) => m.clubId))];
  for (const clubId of clubIds) {
    const choice = await deps.choices.findChoice(user.id, clubId, season);
    const hit = choice?.roles
      .filter((r) => r.startsWith(`${area}.`))
      .map((r) => areaRoles.find((x) => x.key === r.slice(String(area).length + 1)))
      .find((r) => r?.practiceRole);
    if (hit?.practiceRole) return hit.practiceRole;
  }
  return null;
}
