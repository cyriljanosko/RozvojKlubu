import { ApiError } from "@/server/api/errors";
import type { ClubSeasonDoc } from "@/server/db/types";
import { isAdmin } from "@/server/services/club-access";
import type { PlanStore } from "@/server/services/club-plan.service";
import type { ClubDeps } from "@/server/services/clubs.service";
import { profileFromSeason, sizeLabel } from "@/server/services/kompas-export";
import type { KompasResult } from "@/server/services/kompas-scoring";
import {
  isValidSubmission,
  type SubmissionStore,
} from "@/server/services/kompas-submission.service";
import { getKompas, type KompasDeps } from "@/server/services/kompas.service";
import type { LicensingResult } from "@/server/services/licensing-scoring";
import type { LicensingSubmissionStore } from "@/server/services/licensing.service";
import type { MentorVisitStore } from "@/server/services/mentor-visit.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Analysis workspace (DA, decision 22. 10. 2026): panels over the clubs a user may see.
 * - admin_sfz: all pilot clubs; the working Kompas;
 * - mentor: the clubs of their cohort; only the submitted Kompas (as everywhere for mentors);
 * - management and coaches: their own club (working Kompas) and an anonymous average of clubs
 *   of the same size – only when at least 3 such clubs have a submitted Kompas, so that no
 *   single club can be read out of it.
 * No new collection – everything is read from existing data; every query is per clubId (ADR 0003).
 */
export interface AnalyticsDeps extends ClubDeps {
  kompas: KompasDeps;
  submissions: Pick<SubmissionStore, "listSubmissions">;
  licensingSubmissions: Pick<LicensingSubmissionStore, "findSubmission">;
  visits: Pick<MentorVisitStore, "listVisits">;
  plans: Pick<PlanStore, "findPlan">;
}

export type ClubSize = "small" | "medium" | "large";
export type AnalyticsScope = "all" | "mentor" | "club";

const SIZE = { malý: "small", stredný: "medium", veľký: "large" } as const;
/** fewer clubs than this and an anonymous average is not shown */
export const MIN_BENCHMARK = 3;

export interface AnalyticsFilter {
  season?: string | null;
  union?: string | null;
  size?: ClubSize | null;
  /** narrow to these clubs (comparison) */
  clubs?: string[] | null;
}

export interface ClubAnalytics {
  clubId: string;
  name: string;
  union: string;
  size: ClubSize | null;
  kompas: {
    /** points of areas 1–11 (index 0 = area 1), null when not scored */
    areas: (number | null)[];
    total: number | null;
    filledAreas: number;
    source: "submitted" | "working" | null;
  };
  licensing: { key: string; area: number; points: number; band: string | null }[] | null;
  activity: {
    kompasSubmitted: boolean;
    licensingClosed: boolean;
    visits: number;
    actionsDone: number;
    actionsTotal: number;
    planGoals: number;
    planDone: number;
  };
  /** Sportnet by season, oldest first */
  sportnet: {
    season: string;
    players: number;
    teams: number;
    coaches: number;
    coachesWithLicence: number;
    teamsWithoutCoach: number;
  }[];
}

export interface AnalyticsView {
  scope: AnalyticsScope;
  season: string;
  /** unions of the clubs in scope – for the filter */
  unions: string[];
  clubs: ClubAnalytics[];
  /** average over the clubs shown (admin, mentor) */
  average: { kompas: (number | null)[] } | null;
  /** anonymous average of same-size clubs (management, coach) */
  benchmark: { size: ClubSize; clubs: number; kompas: (number | null)[] } | null;
}

/** Pure: mean per area over rows, ignoring missing values; one decimal; null when none. */
export function averageAreas(rows: readonly (readonly (number | null)[])[], areas = 11) {
  return Array.from({ length: areas }, (_, i) => {
    const values = rows.map((r) => r[i]).filter((v): v is number => v !== null && v !== undefined);
    return values.length === 0
      ? null
      : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
  });
}

/** Pure: an anonymous average needs at least MIN_BENCHMARK clubs. */
export const benchmarkAllowed = (clubs: number) => clubs >= MIN_BENCHMARK;

/** Pure: area points of a Kompas result as an array for areas 1–11. */
export function kompasAreas(result: Pick<KompasResult, "areas"> | null): (number | null)[] {
  return Array.from(
    { length: 11 },
    (_, i) => result?.areas.find((a) => a.area === i + 1)?.points ?? null,
  );
}

/** Pure: one Sportnet season as numbers for the trend panel. */
export function sportnetRow(data: ClubSeasonDoc) {
  const p = profileFromSeason(data);
  return {
    season: data.season,
    players: p.youth + p.adults,
    teams: p.teams,
    coaches: p.coaches,
    coachesWithLicence: data.coaches.filter((c) => c.licences.length > 0).length,
    teamsWithoutCoach: p.teamsWithoutCoach,
  };
}

async function sportnetOf(deps: AnalyticsDeps, clubId: string) {
  const names = (await deps.clubs.listSeasonNames(clubId)).sort();
  const seasons = await Promise.all(names.map((s) => deps.clubs.findSeason(clubId, s)));
  return seasons.filter((s): s is ClubSeasonDoc => s !== null).map(sportnetRow);
}

const sizeOf = (rows: ClubAnalytics["sportnet"], season: string): ClubSize | null => {
  const row = rows.find((r) => r.season === season) ?? rows.at(-1);
  return row ? SIZE[sizeLabel(row.players, 0)] : null;
};

async function submittedResult(deps: AnalyticsDeps, clubId: string, season: string) {
  const subs = await deps.submissions.listSubmissions(clubId, season);
  const latest = subs.filter(isValidSubmission).sort((a, b) => +b.submittedAt - +a.submittedAt)[0];
  return latest ? (latest.result as unknown as KompasResult) : null;
}

async function clubAnalytics(
  deps: AnalyticsDeps,
  user: CurrentUser,
  club: { clubId: string; name: string; union: string },
  season: string,
  working: boolean,
): Promise<ClubAnalytics> {
  const [sportnet, submitted, closed, visits, plan] = await Promise.all([
    sportnetOf(deps, club.clubId),
    submittedResult(deps, club.clubId, season),
    deps.licensingSubmissions.findSubmission(club.clubId, season),
    deps.visits.listVisits(club.clubId),
    deps.plans.findPlan(club.clubId, season),
  ]);
  let result: KompasResult | null = submitted;
  let source: ClubAnalytics["kompas"]["source"] = submitted ? "submitted" : null;
  if (working) {
    try {
      result = (await getKompas(deps.kompas, user, club.clubId)).result;
      source = "working";
    } catch {
      // no access to the working Kompas – keep the submitted one
    }
  }
  const sent = visits.filter((v) => v.status === "sent" && v.season === season);
  const actions = sent.flatMap((v) => v.actions);
  const licensing = closed ? (closed.result as unknown as LicensingResult) : null;
  return {
    clubId: club.clubId,
    name: club.name,
    union: club.union,
    size: sizeOf(sportnet, season),
    kompas: {
      areas: kompasAreas(result),
      total: result?.total ?? null,
      filledAreas: result?.filledAreas ?? 0,
      source,
    },
    licensing: licensing
      ? licensing.areas.map((a) => ({ key: a.key, area: a.area, points: a.points, band: a.band }))
      : null,
    activity: {
      kompasSubmitted: submitted !== null,
      licensingClosed: closed !== null,
      visits: sent.length,
      actionsDone: actions.filter((a) => a.done).length,
      actionsTotal: actions.length,
      planGoals: plan?.goals.length ?? 0,
      planDone: plan?.goals.filter((g) => g.status === "done").length ?? 0,
    },
    sportnet,
  };
}

export async function getAnalytics(
  deps: AnalyticsDeps,
  actor: CurrentUser | null,
  filter: AnalyticsFilter = {},
): Promise<AnalyticsView> {
  const user = requireUser(actor);
  const season = filter.season ?? currentSeason(deps.now?.() ?? new Date());
  const now = currentSeason(deps.now?.() ?? new Date());
  const memberships = (await deps.memberships.listByUser(user.id)).filter((m) => m.season === now);
  const mentorIds = new Set(memberships.filter((m) => m.role === "mentor").map((m) => m.clubId));
  const ownIds = new Set(memberships.filter((m) => m.role !== "mentor").map((m) => m.clubId));

  const scope: AnalyticsScope = isAdmin(user) ? "all" : mentorIds.size > 0 ? "mentor" : "club";
  if (scope === "club" && ownIds.size === 0) {
    throw new ApiError("FORBIDDEN", "No club to analyse");
  }
  const allowed =
    scope === "all"
      ? await deps.clubs.listClubs("all")
      : await deps.clubs.listClubs([...new Set([...mentorIds, ...ownIds])]);
  const unions = [...new Set(allowed.map((c) => c.union))].sort((a, b) => a.localeCompare(b, "sk"));

  const picked = allowed
    .filter((c) => !filter.union || c.union === filter.union)
    .filter((c) => !filter.clubs?.length || filter.clubs.includes(c.clubId));
  const clubs = (
    await Promise.all(
      picked.map((c) =>
        clubAnalytics(deps, user, c, season, scope === "all" || ownIds.has(c.clubId)),
      ),
    )
  )
    .filter((c) => !filter.size || c.size === filter.size)
    .sort((a, b) => a.name.localeCompare(b.name, "sk"));

  let benchmark: AnalyticsView["benchmark"] = null;
  if (scope === "club" && clubs[0]?.size) {
    // anonymous: other clubs of the same size, submitted Kompas only, never their names
    const size = clubs[0].size;
    const others = (await deps.clubs.listClubs("all")).filter((c) => !ownIds.has(c.clubId));
    const rows = (
      await Promise.all(
        others.map(async (c) => {
          const s = sizeOf(await sportnetOf(deps, c.clubId), season);
          if (s !== size) return null;
          const r = await submittedResult(deps, c.clubId, season);
          return r ? kompasAreas(r) : null;
        }),
      )
    ).filter((r): r is (number | null)[] => r !== null);
    if (benchmarkAllowed(rows.length)) {
      benchmark = { size, clubs: rows.length, kompas: averageAreas(rows) };
    }
  }

  return {
    scope,
    season,
    unions,
    clubs,
    average: scope === "club" ? null : { kompas: averageAreas(clubs.map((c) => c.kompas.areas)) },
    benchmark,
  };
}
