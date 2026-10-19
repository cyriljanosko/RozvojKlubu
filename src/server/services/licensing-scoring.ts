import type { ClubSeasonDoc, CompetitionLevel, Gender, LicensingInputs } from "@/server/db/types";

import {
  ACTIVITY_ITEMS,
  BAND_MINIMUMS,
  COOPERATION_ITEMS,
  INFRASTRUCTURE_ITEMS,
  LICENSING_BANDS,
  LICENSING_RULE_SET,
  MAIN_LICENCES,
  PLAYER_POINTS,
  SEAT_COEFFICIENTS,
  TEAM_POINTS,
  WOMEN_MULTIPLIER,
  type LicensingBand,
  type ScoredItem,
} from "./licensing-rules";

/**
 * Licensing evaluation – pure scoring (ADR 0006).
 * Areas 2–4 come from the Sportnet snapshot, areas 5–7 from the club's inputs.
 * Bands use the lower bound only (the design's ranges have gaps for decimal points, e.g. 159.6).
 */

export type ManualValue = number | boolean;

export type { LicensingInputs };

export const EMPTY_INPUTS: LicensingInputs = {
  population: null,
  infrastructure: {},
  activities: {},
  cooperation: {},
  coachGender: {},
};

export type AreaKey =
  "teams" | "players" | "coaches" | "infrastructure" | "activities" | "cooperation";

export interface LicensingAreaResult {
  area: number;
  key: AreaKey;
  source: "sportnet" | "club";
  points: number;
  /** null = below the first band, not filled in, or the area has no bands */
  band: LicensingBand | null;
  status: "scored" | "noBand" | "empty" | "unbanded";
}

export interface TeamRow {
  bucket: "adults" | "u11" | "u12_u15" | "u16_u19";
  gender: Gender;
  levels: Record<CompetitionLevel, number>;
  points: number;
}

export interface CoachRow {
  name: string;
  teams: string[];
  gender: Gender;
  genderGuessed: boolean;
  bestLicence: string | null;
  otherLicences: string[];
  expiredLicences: string[];
  points: number;
}

export interface LicensingResult {
  ruleSet: typeof LICENSING_RULE_SET;
  coefficient: number;
  /** false when no population was entered (coefficient 1.0) */
  coefficientFromPopulation: boolean;
  areas: LicensingAreaResult[];
  teams: { rows: TeamRow[]; subtotal: number; teamsWithoutCompetition: number };
  players: {
    rows: { ageGroup: string; men: number; women: number; points: number }[];
    subtotal: number;
  };
  coaches: { rows: CoachRow[]; withoutLicence: number };
}

/** Rounded to one decimal, as shown in the design. */
export const round1 = (n: number) => Math.round(n * 10) / 10;

export function seatCoefficient(population: number | null | undefined): number | null {
  if (population === null || population === undefined || !Number.isFinite(population)) return null;
  if (population < 0) return null;
  let coef = SEAT_COEFFICIENTS[0][1];
  for (const [min, value] of SEAT_COEFFICIENTS) if (population >= min) coef = value;
  return coef;
}

export function bandFor(minimums: readonly number[], points: number): LicensingBand | null {
  let band: LicensingBand | null = null;
  minimums.forEach((min, i) => {
    if (points >= min) band = LICENSING_BANDS[i];
  });
  return band;
}

/** Sportnet does not publish gender: a surname ending in -ová / -á is taken as a woman. */
export function guessGender(name: string): Gender {
  const last = name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? "";
  return /(ová|á)$/.test(last) ? "F" : "M";
}

const AGE_ORDER = [
  "ADULTS",
  "U21",
  "U19",
  "U18",
  "U17",
  "U16",
  "U15",
  "U14",
  "U13",
  "U12",
  "U11",
  "U10",
  "U09",
  "U08",
  "U07",
  "U06",
  "U05",
];

function bucketOf(ageGroup: string): TeamRow["bucket"] {
  if (ageGroup === "ADULTS" || ageGroup === "U21") return "adults";
  const n = Number.parseInt(ageGroup.slice(1), 10);
  return n <= 11 ? "u11" : n <= 15 ? "u12_u15" : "u16_u19";
}

function itemPoints(item: ScoredItem, value: ManualValue | undefined): number {
  if (value === undefined || value === false) return 0;
  const n = typeof value === "boolean" ? 1 : Math.max(0, value);
  if (item.type === "toggle") return n > 0 ? item.points : 0;
  if (item.type === "count") return n * item.points;
  return item.tiers[Math.min(2, Math.floor(n))];
}

const filled = (values: Record<string, ManualValue>) =>
  Object.values(values).some((v) => v === true || (typeof v === "number" && v > 0));

export function scoreLicensing(
  season: Pick<ClubSeasonDoc, "teams" | "players" | "coaches"> | null,
  inputs: LicensingInputs,
): LicensingResult {
  const fromPopulation = seatCoefficient(inputs.population);
  const coefficient = fromPopulation ?? 1;

  // Area 2 – teams in a competition (each team once), women's × 1.5, × 20, × coefficient.
  const buckets: TeamRow["bucket"][] = ["adults", "u11", "u12_u15", "u16_u19"];
  const rows: TeamRow[] = buckets.flatMap((bucket) =>
    (["M", "F"] as const).map((gender) => ({
      bucket,
      gender,
      levels: { ObFZ: 0, RFZ: 0, SFZ: 0 },
      points: 0,
    })),
  );
  let teamsWithoutCompetition = 0;
  for (const t of season?.teams ?? []) {
    if (!t.level) {
      teamsWithoutCompetition++;
      continue;
    }
    rows.find((r) => r.bucket === bucketOf(t.ageGroup) && r.gender === t.gender)!.levels[t.level]++;
  }
  for (const r of rows) {
    const n = r.levels.ObFZ + r.levels.RFZ + r.levels.SFZ;
    r.points = n * TEAM_POINTS * (r.gender === "F" ? WOMEN_MULTIPLIER : 1);
  }
  const teamsSubtotal = rows.reduce((s, r) => s + r.points, 0);
  const teamPoints = teamsSubtotal * coefficient;

  // Area 3 – players + female players × 1.5, × coefficient.
  const byAge = new Map<string, { men: number; women: number }>();
  for (const p of season?.players ?? []) {
    const row = byAge.get(p.ageGroup) ?? { men: 0, women: 0 };
    if (p.gender === "F") row.women += p.count;
    else row.men += p.count;
    byAge.set(p.ageGroup, row);
  }
  const playerRows = [...byAge.entries()]
    .sort(([a], [b]) => AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b))
    .map(([ageGroup, r]) => ({
      ageGroup,
      ...r,
      points: (r.men + r.women * WOMEN_MULTIPLIER) * PLAYER_POINTS,
    }));
  const playersSubtotal = playerRows.reduce((s, r) => s + r.points, 0);
  const playerPoints = playersSubtotal * coefficient;

  // Area 4 – highest valid main licence per coach, women × 1.5, no coefficient.
  const coachRows: CoachRow[] = (season?.coaches ?? []).map((c) => {
    const best = MAIN_LICENCES.find(([name]) => c.licences.includes(name)) ?? null;
    const corrected = inputs.coachGender[c.name];
    const gender = corrected ?? guessGender(c.name);
    return {
      name: c.name,
      teams: c.teams,
      gender,
      genderGuessed: corrected === undefined,
      bestLicence: best?.[0] ?? null,
      otherLicences: c.licences.filter((l) => l !== best?.[0]),
      expiredLicences: c.expiredLicences,
      points: best ? best[1] * (gender === "F" ? WOMEN_MULTIPLIER : 1) : 0,
    };
  });
  const coachPoints = coachRows.reduce((s, r) => s + r.points, 0);

  // Areas 5–7 – club inputs.
  const infraPoints = INFRASTRUCTURE_ITEMS.reduce(
    (s, [key, pts]) => s + Math.max(0, inputs.infrastructure[key] ?? 0) * pts,
    0,
  );
  const activityPoints = ACTIVITY_ITEMS.reduce(
    (s, item) => s + itemPoints(item, inputs.activities[item.key]),
    0,
  );
  const cooperationPoints = COOPERATION_ITEMS.reduce(
    (s, item) => s + itemPoints(item, inputs.cooperation[item.key]),
    0,
  );

  const banded = (
    area: number,
    key: Exclude<AreaKey, "cooperation">,
    source: LicensingAreaResult["source"],
    points: number,
    isFilled = true,
  ): LicensingAreaResult => {
    if (!isFilled) return { area, key, source, points, band: null, status: "empty" };
    const band = bandFor(BAND_MINIMUMS[key], points);
    return { area, key, source, points, band, status: band ? "scored" : "noBand" };
  };
  const scoredManual = (keys: readonly ScoredItem[], values: Record<string, ManualValue>) =>
    filled(Object.fromEntries(keys.map((k) => [k.key, values[k.key] ?? 0])));

  return {
    ruleSet: LICENSING_RULE_SET,
    coefficient,
    coefficientFromPopulation: fromPopulation !== null,
    areas: [
      banded(2, "teams", "sportnet", teamPoints),
      banded(3, "players", "sportnet", playerPoints),
      banded(4, "coaches", "sportnet", coachPoints),
      banded(
        5,
        "infrastructure",
        "club",
        infraPoints,
        INFRASTRUCTURE_ITEMS.some(([key]) => (inputs.infrastructure[key] ?? 0) > 0),
      ),
      banded(
        6,
        "activities",
        "club",
        activityPoints,
        scoredManual(ACTIVITY_ITEMS, inputs.activities),
      ),
      {
        area: 7,
        key: "cooperation",
        source: "club",
        points: cooperationPoints,
        band: null,
        status: "unbanded",
      },
    ],
    teams: { rows, subtotal: teamsSubtotal, teamsWithoutCompetition },
    players: { rows: playerRows, subtotal: playersSubtotal },
    coaches: { rows: coachRows, withoutLicence: coachRows.filter((r) => !r.bestLicence).length },
  };
}
