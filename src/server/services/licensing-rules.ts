/**
 * Licensing rule set "pilot 2026, provisional" – the same numbers as the Vizitka design (ADR 0006).
 * Area numbers follow the licensing system (2 Teams … 7 Cooperation), not the 11 Academy areas.
 * Points in areas 6 and 7 are provisional; area 7 has no bands; the overall club level is not defined yet.
 */

export const LICENSING_RULE_SET = "pilot-2026" as const;

export const LICENSING_BANDS = ["grassroots", "bronze", "silver", "gold"] as const;
export type LicensingBand = (typeof LICENSING_BANDS)[number];

/** Lower bound of each band (grassroots, bronze, silver, gold); below the first bound = no band. */
export const BAND_MINIMUMS = {
  teams: [0, 100, 160, 200],
  players: [15, 40, 80, 120],
  coaches: [0, 20, 40, 60],
  infrastructure: [0, 60, 120, 180],
  activities: [0, 149, 249, 350],
} as const;

/** Seat coefficient by population: [min inhabitants, coefficient], highest matching min wins. */
export const SEAT_COEFFICIENTS: readonly (readonly [number, number])[] = [
  [0, 1.9],
  [100, 1.8],
  [200, 1.7],
  [500, 1.6],
  [1000, 1.5],
  [2000, 1.4],
  [5000, 1.3],
  [10000, 1.2],
  [30000, 1.1],
  [50000, 1.0],
];

export const TEAM_POINTS = 20;
export const WOMEN_MULTIPLIER = 1.5;
export const PLAYER_POINTS = 1;

/** Main licences in order of value; the highest valid one counts. Others are shown, not scored. */
export const MAIN_LICENCES: readonly (readonly [string, number])[] = [
  ["UEFA PRO", 15],
  ["UEFA A", 10],
  ["UEFA B", 6],
  ["UEFA C", 4],
  ["UEFA Grassroots C", 2],
  ["SFZ Grassroots Leader", 1],
];

/** Area 5 – count of pieces × points. */
export const INFRASTRUCTURE_ITEMS = [
  ["grass_105x68", 30],
  ["grass_100x60", 20],
  ["grass_90x45", 10],
  ["grass_small", 5],
  ["turf_105x68", 30],
  ["turf_100x60", 20],
  ["turf_90x45", 10],
  ["turf_small", 5],
  ["mini_40x20", 20],
  ["mini_small", 10],
  ["floodlit_pitches", 10],
  ["hall_40x20", 20],
  ["hall_36x16", 10],
  ["hall_small", 5],
  ["air_dome", 20],
  ["goals_732x244", 5],
  ["goals_5x2", 5],
  ["goals_15x1", 2],
] as const satisfies readonly (readonly [string, number])[];

/** toggle = points when yes; count = count × points; tier = 0 / 1 / 2+ events → points. */
export type ScoredItem =
  | { key: string; type: "toggle"; points: number }
  | { key: string; type: "count"; points: number }
  | { key: string; type: "tier"; tiers: readonly [number, number, number] };

/** Area 6 – provisional points. */
export const ACTIVITY_ITEMS: readonly ScoredItem[] = [
  { key: "xps_training_records", type: "toggle", points: 50 },
  { key: "recruitment_events", type: "tier", tiers: [0, 20, 50] },
  { key: "youth_tournaments", type: "count", points: 20 },
  { key: "summer_camps", type: "toggle", points: 50 },
  { key: "website", type: "toggle", points: 50 },
  { key: "facebook", type: "toggle", points: 50 },
  { key: "instagram", type: "toggle", points: 50 },
  { key: "youtube", type: "toggle", points: 50 },
];

/** Area 6 – recorded counts without points. */
export const ACTIVITY_RECORDS = [
  "training_camp_teams",
  "veterans_40",
  "seniors_60",
  "internal_coach_education",
  "guest_coach_sessions",
  "specialised_sessions_per_month",
] as const;

/** Area 7 – provisional points, no bands. */
export const COOPERATION_ITEMS: readonly ScoredItem[] = [
  { key: "commission_sfz", type: "count", points: 100 },
  { key: "commission_rfz", type: "count", points: 50 },
  { key: "commission_obfz", type: "count", points: 30 },
  { key: "regional_gtm", type: "toggle", points: 50 },
  { key: "school_festivals", type: "tier", tiers: [0, 20, 50] },
  { key: "school_clubs", type: "toggle", points: 50 },
  { key: "coach_teaches_school", type: "toggle", points: 50 },
  { key: "mcdonalds_cup", type: "toggle", points: 20 },
  { key: "school_futsal_league", type: "toggle", points: 20 },
];

/** Area 7 – recorded yes/no without points. */
export const COOPERATION_RECORDS = [
  "regional_selections",
  "pitch_rental_selections",
  "regional_competitions",
  "russ",
  "school_competitions",
  "municipality",
  "other_sports_club",
  "business_partner",
  "private_groups",
  "coach_dsg_school",
  "coach_afternoon_school",
  "school_tournaments",
  "childrens_homes",
  "disability_activities",
  "open_pitches_weekend",
  "public_events",
] as const;
