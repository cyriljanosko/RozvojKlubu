import type { ClubSeasonDoc } from "@/server/db/types";
import type { KompasResult } from "@/server/services/kompas-scoring";

/**
 * Mentor transfer line, identical to Kompas klubu v2/v13 so the existing collection sheet keeps working:
 *   SFZ-KOMPAS-1|club|ObFZ|region|season|size|u-s ×11 (comma, "-" = not scored)|profile
 * profile = teams;youth;girls;coaches;womenCoaches;schools;adults;teamsWithoutCoach
 * (zero for teams/youth/schools/adults is written as empty, like the original).
 */
export interface KompasLineInput {
  clubName: string;
  union: string;
  region: string;
  season: string;
  result: KompasResult;
  profile: KompasProfile;
}

export interface KompasProfile {
  teams: number;
  youth: number;
  adults: number;
  girls: number;
  coaches: number;
  /** not available in Sportnet data – empty */
  womenCoaches: number | null;
  /** not available in Sportnet data – empty */
  schools: number | null;
  teamsWithoutCoach: number;
}

const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/[|\r\n]+/g, " ")
    .trim();
const orEmpty = (n: number | null) => (n ? String(n) : "");
const value = (n: number | null) => (n === null ? "" : String(Math.trunc(n)));

export function sizeLabel(youth: number, adults: number): "malý" | "stredný" | "veľký" {
  const m = youth + adults;
  return m >= 200 ? "veľký" : m >= 80 ? "stredný" : "malý";
}

/** Profile numbers from the Sportnet season data (snapshot). */
export function profileFromSeason(season: ClubSeasonDoc | null): KompasProfile {
  if (!season) {
    return {
      teams: 0,
      youth: 0,
      adults: 0,
      girls: 0,
      coaches: 0,
      womenCoaches: null,
      schools: null,
      teamsWithoutCoach: 0,
    };
  }
  const youthRows = season.players.filter((p) => p.ageGroup !== "ADULTS");
  const coached = new Set(season.coaches.flatMap((c) => c.teams));
  return {
    teams: season.teams.length,
    youth: youthRows.reduce((s, p) => s + p.count, 0),
    adults: season.players.filter((p) => p.ageGroup === "ADULTS").reduce((s, p) => s + p.count, 0),
    girls: youthRows.filter((p) => p.gender === "F").reduce((s, p) => s + p.count, 0),
    coaches: season.coaches.length,
    womenCoaches: null,
    schools: null,
    teamsWithoutCoach: season.teams.filter((t) => !coached.has(t.name)).length,
  };
}

export function kompasLine(input: KompasLineInput): string {
  const pairs = input.result.areas
    .slice()
    .sort((a, b) => a.area - b.area)
    .map((a) => (a.points === null ? "-" : `${a.columns.i.points}-${a.columns.s.points}`))
    .join(",");
  const p = input.profile;
  const profile = [
    orEmpty(p.teams),
    orEmpty(p.youth),
    value(p.girls),
    value(p.coaches),
    value(p.womenCoaches),
    orEmpty(p.schools),
    orEmpty(p.adults),
    value(p.teamsWithoutCoach),
  ].join(";");
  return [
    "SFZ-KOMPAS-1",
    clean(input.clubName) || "Nezadaný klub",
    clean(input.union),
    clean(input.region),
    clean(input.season),
    sizeLabel(p.youth, p.adults),
    pairs,
    profile,
  ].join("|");
}
