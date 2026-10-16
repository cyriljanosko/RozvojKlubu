import { ApiError } from "@/server/api/errors";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { ContentStore } from "@/server/services/content.service";
import { profileFromSeason, sizeLabel } from "@/server/services/kompas-export";
import type { BandKey, KompasResult } from "@/server/services/kompas-scoring";
import type { SubmissionStore } from "@/server/services/kompas-submission.service";
import type { AssessmentStore } from "@/server/services/kompas.service";
import type { LicensingBand } from "@/server/services/licensing-rules";
import type { AreaKey, LicensingResult } from "@/server/services/licensing-scoring";
import type {
  EvaluationStore,
  LicensingSubmissionStore,
} from "@/server/services/licensing.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Vizitka klubu (ADR 0006, 0007): Kompas and licensing evaluation of a season side by side,
 * only from the last submitted Kompas and the closed licensing evaluation.
 * - public view: no sign-in, profile and area results only (no names, no answers, no dates);
 * - club view (any club role, admin_sfz): plus dates, seat coefficient and the state of the drafts.
 * Every query is scoped by clubId (ADR 0003).
 */
export interface VizitkaDeps extends ClubDeps {
  content: Pick<ContentStore, "listAreas">;
  assessments: Pick<AssessmentStore, "findAssessment">;
  submissions: Pick<SubmissionStore, "listSubmissions">;
  evaluations: Pick<EvaluationStore, "findEvaluation">;
  licensingSubmissions: Pick<LicensingSubmissionStore, "findSubmission">;
}

export type ClubSize = "small" | "medium" | "large";
const SIZE: Record<ReturnType<typeof sizeLabel>, ClubSize> = {
  malý: "small",
  stredný: "medium",
  veľký: "large",
};

export interface PublicVizitka {
  club: { clubId: string; name: string; union: string; region: string };
  season: string;
  /** seasons with Sportnet data, newest first */
  seasons: string[];
  profile: { size: ClubSize; teams: number; players: number; coaches: number } | null;
  kompas: {
    total: number;
    filledAreas: number;
    areas: {
      area: number;
      name: string;
      points: number | null;
      band: BandKey | null;
      status: "empty" | "few" | "scored";
    }[];
  } | null;
  licensing: {
    areas: {
      area: number;
      key: AreaKey;
      points: number;
      band: LicensingBand | null;
      status: "scored" | "noBand" | "empty" | "unbanded";
    }[];
  } | null;
}

export interface ClubVizitka extends PublicVizitka {
  kompasSubmittedAt: Date | null;
  licensingClosedAt: Date | null;
  licensingCoefficient: number | null;
  /** working versions not yet submitted / closed (0 = none) */
  drafts: { kompasVersion: number; licensingVersion: number };
}

async function build(deps: VizitkaDeps, clubId: string, requested?: string | null) {
  const club = await deps.clubs.findClub(clubId);
  if (!club) throw new ApiError("NOT_FOUND", "Club not found");
  const current = currentSeason(deps.now?.() ?? new Date());
  const seasons = (await deps.clubs.listSeasonNames(clubId)).sort().reverse();
  if (seasons.length === 0) seasons.push(current);
  if (requested && !seasons.includes(requested))
    throw new ApiError("NOT_FOUND", "Season not found");
  const season = requested ?? (seasons.includes(current) ? current : seasons[0]);

  const [seasonData, areas, kompasSubs, closed] = await Promise.all([
    deps.clubs.findSeason(clubId, season),
    deps.content.listAreas(),
    deps.submissions.listSubmissions(clubId, season),
    deps.licensingSubmissions.findSubmission(clubId, season),
  ]);
  const latest = [...kompasSubs].sort((a, b) => +b.submittedAt - +a.submittedAt)[0] ?? null;
  const kompasResult = latest ? (latest.result as unknown as KompasResult) : null;
  const licensingResult = closed ? (closed.result as unknown as LicensingResult) : null;
  const profile = seasonData ? profileFromSeason(seasonData) : null;

  const view: PublicVizitka = {
    club: { clubId: club.clubId, name: club.name, union: club.union, region: club.region },
    season,
    seasons,
    profile: profile
      ? {
          size: SIZE[sizeLabel(profile.youth, profile.adults)],
          teams: profile.teams,
          players: profile.youth + profile.adults,
          coaches: profile.coaches,
        }
      : null,
    kompas: kompasResult
      ? {
          total: kompasResult.total,
          filledAreas: kompasResult.filledAreas,
          areas: kompasResult.areas.map((a) => ({
            area: a.area,
            name: areas.find((x) => x.number === a.area)?.name ?? "",
            points: a.points,
            band: a.band,
            status: a.status,
          })),
        }
      : null,
    licensing: licensingResult
      ? {
          areas: licensingResult.areas.map((a) => ({
            area: a.area,
            key: a.key,
            points: a.points,
            band: a.band,
            status: a.status,
          })),
        }
      : null,
  };
  return { view, latest, closed, licensingResult };
}

/** Public Vizitka – no sign-in required. */
export async function getPublicVizitka(
  deps: VizitkaDeps,
  clubId: string,
  season?: string | null,
): Promise<PublicVizitka> {
  return (await build(deps, clubId, season)).view;
}

/** Vizitka for club roles (management, coach, mentor) and admin_sfz. */
export async function getClubVizitka(
  deps: VizitkaDeps,
  actor: CurrentUser | null,
  clubId: string,
  season?: string | null,
): Promise<ClubVizitka> {
  const user = requireUser(actor);
  if (!isAdmin(user)) {
    const roles = clubRolesFor(
      await deps.memberships.listByUser(user.id),
      clubId,
      currentSeason(deps.now?.() ?? new Date()),
    );
    if (roles.length === 0) throw new ApiError("FORBIDDEN", "No access to this club");
  }
  const { view, latest, closed, licensingResult } = await build(deps, clubId, season);
  const [assessment, evaluation] = await Promise.all([
    deps.assessments.findAssessment(clubId, view.season),
    deps.evaluations.findEvaluation(clubId, view.season),
  ]);
  return {
    ...view,
    kompasSubmittedAt: latest?.submittedAt ?? null,
    licensingClosedAt: closed?.closedAt ?? null,
    licensingCoefficient: licensingResult?.coefficient ?? null,
    drafts: {
      kompasVersion: assessment?.version ?? 0,
      licensingVersion: evaluation?.version ?? 0,
    },
  };
}
