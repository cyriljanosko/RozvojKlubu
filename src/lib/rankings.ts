import type { ClubPlace, MapLevel } from "@/lib/slovakia-map";

/**
 * Rebríčky klubov (VK-b, decisions 26. 10. 2026): two separate star ratings shown side by side,
 * never added up.
 * - Kompas: points of the submitted Kompas (0–220) in five bands of 20 % (44 points each);
 * - licensing: the average band of the closed licensing evaluation's areas – no band 1,
 *   grassroots 2, bronze 3, silver 4, gold 5; areas without bands do not count.
 */
export const KOMPAS_MAX = 220;
const KOMPAS_BAND = KOMPAS_MAX / 5;

/** Pure: 0–5 stars of the Kompas points; null when no Kompas was submitted. */
export function kompasStars(points: number | null): number | null {
  if (points === null) return null;
  if (points <= 0) return 0;
  return Math.min(5, Math.ceil(points / KOMPAS_BAND));
}

const BAND_LEVEL = { grassroots: 2, bronze: 3, silver: 4, gold: 5 } as const;

/** Pure: 1–5 stars of the closed licensing areas; null when no area has bands. */
export function licensingStars(
  areas: readonly { band: keyof typeof BAND_LEVEL | null; status: string }[],
): number | null {
  const banded = areas.filter((a) => a.status !== "unbanded");
  if (banded.length === 0) return null;
  const sum = banded.reduce((s, a) => s + (a.band ? BAND_LEVEL[a.band] : 1), 0);
  return Math.round(sum / banded.length);
}

export interface RankedClub {
  clubId: string;
  name: string;
  place: ClubPlace | null;
  players: number | null;
  kompas: number | null;
  kompasStars: number | null;
  licensing: { points: number; stars: number | null } | null;
}

export const RANK_SORTS = ["kompas", "licensing", "players", "obfz", "rfz"] as const;
export type RankSort = (typeof RANK_SORTS)[number];

/** descending, missing values last */
const desc = (a: number | null | undefined, b: number | null | undefined) => (b ?? -1) - (a ?? -1);
const byName = (a: RankedClub, b: RankedClub) => a.name.localeCompare(b.name, "sk");
const byKompas = (a: RankedClub, b: RankedClub) =>
  desc(a.kompasStars, b.kompasStars) || desc(a.kompas, b.kompas);
const byLicensing = (a: RankedClub, b: RankedClub) =>
  desc(a.licensing?.stars, b.licensing?.stars) || desc(a.licensing?.points, b.licensing?.points);
const byText = (a: string | undefined, b: string | undefined) =>
  a === b ? 0 : a === undefined ? 1 : b === undefined ? -1 : a.localeCompare(b, "sk");

/** Pure: the clubs in the order of the chosen ranking (a new array). */
export function sortClubs<T extends RankedClub>(clubs: readonly T[], sort: RankSort): T[] {
  const compare: Record<RankSort, (a: RankedClub, b: RankedClub) => number> = {
    kompas: (a, b) => byKompas(a, b) || byLicensing(a, b) || byName(a, b),
    licensing: (a, b) => byLicensing(a, b) || byKompas(a, b) || byName(a, b),
    players: (a, b) => desc(a.players, b.players) || byName(a, b),
    obfz: (a, b) => byText(a.place?.obfz, b.place?.obfz) || byKompas(a, b) || byName(a, b),
    rfz: (a, b) => byText(a.place?.rfz, b.place?.rfz) || byKompas(a, b) || byName(a, b),
  };
  return [...clubs].sort(compare[sort]);
}

export interface UnionRating {
  /** RFZ code or ObFZ name */
  id: string;
  clubs: number;
  /** average stars of the clubs that have them, one decimal; null when none has */
  kompas: number | null;
  licensing: number | null;
}

const average = (values: (number | null)[]) => {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0
    ? null
    : Math.round((known.reduce((s, v) => s + v, 0) / known.length) * 10) / 10;
};

/** Pure: average stars per union of a level, best Kompas average first. */
export function unionRatings(clubs: readonly RankedClub[], level: MapLevel): UnionRating[] {
  const groups = new Map<string, RankedClub[]>();
  for (const c of clubs) {
    if (!c.place) continue;
    const key = level === "rfz" ? c.place.rfz : c.place.obfz;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({
      id,
      clubs: list.length,
      kompas: average(list.map((c) => c.kompasStars)),
      licensing: average(list.map((c) => c.licensing?.stars ?? null)),
    }))
    .sort(
      (a, b) =>
        desc(a.kompas, b.kompas) ||
        desc(a.licensing, b.licensing) ||
        a.id.localeCompare(b.id, "sk"),
    );
}

/** Milestones of a season (ADR 0015), in the order they are shown. */
export const MILESTONES = ["kompas", "confirmed", "plan", "goal", "visit", "licensing"] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Kompas of this season against the last one of the previous season (ADR 0015). */
export interface KompasProgress {
  /** points gained (may be negative) */
  points: number;
  fromStars: number;
  toStars: number;
}

/** Pure: progress between two Kompas totals; null when either is missing. */
export function kompasProgress(
  previous: number | null,
  latest: number | null,
): KompasProgress | null {
  if (previous === null || latest === null) return null;
  return {
    points: latest - previous,
    fromStars: kompasStars(previous) ?? 0,
    toStars: kompasStars(latest) ?? 0,
  };
}

/** Pure: the season before "2026/2027" is "2025/2026". */
export function previousSeason(season: string): string {
  const start = Number(season.slice(0, 4));
  return `${start - 1}/${start}`;
}

/** what the public top 3 are ordered by – ordering by players, ObFZ or RFZ ranks by the Kompas */
const rankingSort = (sort: RankSort): "kompas" | "licensing" =>
  sort === "licensing" ? "licensing" : "kompas";
const valueOf = (c: RankedClub, by: "kompas" | "licensing") =>
  by === "kompas" ? c.kompasStars : (c.licensing?.stars ?? null);

/** Pure: the clubs in ranking order – only those with a value for it (no "last places" of empty ones). */
export function rankingOrder<T extends RankedClub>(clubs: readonly T[], sort: RankSort): T[] {
  const by = rankingSort(sort);
  return sortClubs(
    clubs.filter((c) => valueOf(c, by) !== null),
    by,
  );
}

/** Pure: the public top 3 of a ranking (ADR 0015) – fewer when fewer clubs have a value. */
export const topThree = <T extends RankedClub>(clubs: readonly T[], sort: RankSort): T[] =>
  rankingOrder(clubs, sort).slice(0, 3);

/** Pure: the top 3 by progress – only clubs that improved, the biggest gain first. */
export function topProgress<T extends RankedClub & { progress: KompasProgress | null }>(
  clubs: readonly T[],
): T[] {
  return clubs
    .filter((c) => (c.progress?.points ?? 0) > 0)
    .sort((a, b) => b.progress!.points - a.progress!.points || a.name.localeCompare(b.name, "sk"))
    .slice(0, 3);
}

/** Pure: 1-based position of a club in the ranking and the number of ranked clubs; null when not ranked. */
export function positionOf(
  clubs: readonly RankedClub[],
  clubId: string,
  sort: RankSort,
): { position: number; of: number } | null {
  const order = rankingOrder(clubs, sort);
  const i = order.findIndex((c) => c.clubId === clubId);
  return i < 0 ? null : { position: i + 1, of: order.length };
}
