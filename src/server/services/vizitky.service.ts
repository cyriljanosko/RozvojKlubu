import {
  kompasProgress,
  kompasStars,
  licensingStars,
  milestonesOf,
  previousSeason,
  type KompasProgress,
  type Milestone,
  type RankedClub,
} from "@/lib/rankings";
import { placeOf } from "@/lib/slovakia-map";
import type { ClubRole } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { PlanStore } from "@/server/services/club-plan.service";
import type { ClubSettingsStore } from "@/server/services/club-settings.service";
import type { ClubSize } from "@/server/services/analytics.service";
import { isValidSubmission } from "@/server/services/kompas-submission.service";
import type { KompasResult } from "@/server/services/kompas-scoring";
import type { MentorVisitStore } from "@/server/services/mentor-visit.service";
import { currentSeason } from "@/server/services/season";
import type { CurrentUser } from "@/server/services/users.service";
import { getPublicVizitka, type VizitkaDeps } from "@/server/services/vizitka.service";

/**
 * Public list of club Vizitky for the map and the rankings (VK-a, VK-b; MR-b, ADR 0015): the pilot
 * clubs with where they are (district → ObFZ → RFZ) and their size. Stars, licensing points,
 * progress, the mentor's confirmation and the season's milestones only for clubs whose management
 * consented to the public rankings – the others show up neutrally, without any rating.
 */
export interface VizitkaCard extends RankedClub {
  /** union of the competitions (Sportnet), e.g. "ObFZ Trebišov" or "SFZ" */
  union: string;
  size: ClubSize | null;
  /** management consented to the public rankings (opt-in) – only then the ratings below are set */
  ranked: boolean;
  /** the latest Kompas is confirmed by the club's mentor (a badge) */
  confirmed: boolean;
  /** Kompas against the previous season; null without a Kompas in both seasons */
  progress: KompasProgress | null;
  /** milestones reached in the Vizitka's season */
  milestones: Milestone[];
}

export interface RankingsDeps extends VizitkaDeps {
  settings: Pick<ClubSettingsStore, "listRankingConsents" | "findSettings">;
  plans: Pick<PlanStore, "findPlan">;
  visits: Pick<MentorVisitStore, "listVisits">;
}

/** Who looks: whose full position (not public) they may see and which clubs are their own. */
export interface RankingsViewer {
  /** admin_sfz: every club; mentor: their clubs; management and coach: their own club */
  positions: "all" | string[];
  /** clubs where the viewer is management or coach – "Váš klub" line */
  own: string[];
}

export interface VizitkyView {
  cards: VizitkaCard[];
  viewer: RankingsViewer;
}

const totalOf = (s: { result: Record<string, unknown> }) =>
  (s.result as unknown as KompasResult).total;

async function latestKompas(
  deps: Pick<RankingsDeps, "submissions">,
  clubId: string,
  season: string,
) {
  const subs = await deps.submissions.listSubmissions(clubId, season);
  return subs.filter(isValidSubmission).sort((a, b) => +b.submittedAt - +a.submittedAt)[0] ?? null;
}

async function viewerOf(deps: RankingsDeps, actor: CurrentUser | null): Promise<RankingsViewer> {
  if (!actor) return { positions: [], own: [] };
  if (isAdmin(actor)) return { positions: "all", own: [] };
  const season = currentSeason(deps.now?.() ?? new Date());
  const memberships = (await deps.memberships.listByUser(actor.id)).filter(
    (m) => m.season === season,
  );
  const ids = [...new Set(memberships.map((m) => m.clubId))];
  const has = (clubId: string, role: ClubRole) =>
    clubRolesFor(memberships, clubId, season).includes(role);
  const own = ids.filter((id) => has(id, "management") || has(id, "coach"));
  const mentored = ids.filter((id) => has(id, "mentor"));
  return { positions: [...new Set([...own, ...mentored])], own };
}

type MilestoneDeps = Pick<RankingsDeps, "submissions" | "plans" | "visits">;

/** The season's milestones of a club with its latest valid Kompas (shared by the rankings,
 *  the public Vizitka and Moja Akadémia). */
export async function seasonMilestones(
  deps: MilestoneDeps,
  clubId: string,
  season: string,
  licensingClosed: boolean,
) {
  const [latest, plan, visits] = await Promise.all([
    latestKompas(deps, clubId, season),
    deps.plans.findPlan(clubId, season),
    deps.visits.listVisits(clubId),
  ]);
  const confirmed = Boolean(latest?.confirmedAt);
  return {
    latest,
    confirmed,
    milestones: milestonesOf({
      kompas: latest !== null,
      confirmed,
      goals: plan?.goals ?? null,
      sentVisit: visits.some((x) => x.season === season && x.status === "sent"),
      licensing: licensingClosed,
    }),
  };
}

/** Milestones for the public Vizitka – only when the club consented to the rankings (ADR 0015). */
export async function getPublicMilestones(
  deps: RankingsDeps,
  clubId: string,
  season: string,
): Promise<Milestone[] | null> {
  const settings = await deps.settings.findSettings(clubId);
  if (!settings?.rankingConsent?.given) return null;
  const closed = await deps.licensingSubmissions.findSubmission(clubId, season);
  return (await seasonMilestones(deps, clubId, season, closed !== null)).milestones;
}

export async function listVizitky(
  deps: RankingsDeps,
  actor: CurrentUser | null = null,
): Promise<VizitkyView> {
  const [clubs, consents, viewer] = await Promise.all([
    deps.clubs.listClubs("all"),
    deps.settings.listRankingConsents(),
    viewerOf(deps, actor),
  ]);
  const consenting = new Set(consents);
  const cards = await Promise.all(
    clubs.map(async (c): Promise<VizitkaCard> => {
      const v = await getPublicVizitka(deps, c.clubId);
      const base = {
        clubId: c.clubId,
        name: c.name,
        union: c.union,
        place: placeOf(c.clubId),
        size: v.profile?.size ?? null,
        players: v.profile?.players ?? null,
      };
      if (!consenting.has(c.clubId)) {
        return {
          ...base,
          ranked: false,
          kompas: null,
          kompasStars: null,
          licensing: null,
          confirmed: false,
          progress: null,
          milestones: [],
        };
      }
      const [{ latest, confirmed, milestones }, previous] = await Promise.all([
        seasonMilestones(deps, c.clubId, v.season, v.licensing !== null),
        latestKompas(deps, c.clubId, previousSeason(v.season)),
      ]);
      const kompas = latest ? totalOf(latest) : null;
      return {
        ...base,
        ranked: true,
        kompas,
        kompasStars: kompasStars(kompas),
        licensing: v.licensing
          ? {
              points: v.licensing.areas.reduce((s, a) => s + a.points, 0),
              stars: licensingStars(v.licensing.areas),
            }
          : null,
        confirmed,
        progress: kompasProgress(previous ? totalOf(previous) : null, kompas),
        milestones,
      };
    }),
  );
  return { cards: cards.sort((a, b) => a.name.localeCompare(b.name, "sk")), viewer };
}
