import { describe, expect, it } from "vitest";

import type { ClubSeasonDoc } from "@/server/db/types";

import {
  bandFor,
  EMPTY_INPUTS,
  guessGender,
  scoreLicensing,
  seatCoefficient,
} from "./licensing-scoring";

type Season = Pick<ClubSeasonDoc, "teams" | "players" | "coaches">;

const season: Season = {
  teams: [
    {
      name: "Dospelí",
      gender: "M",
      ageGroup: "ADULTS",
      level: "ObFZ",
      competitions: ["VII. liga"],
      playerCount: 22,
    },
    {
      name: "U13",
      gender: "M",
      ageGroup: "U13",
      level: "RFZ",
      competitions: ["II. liga U13"],
      playerCount: 18,
    },
    {
      name: "U15 ženy",
      gender: "F",
      ageGroup: "U15",
      level: "SFZ",
      competitions: ["I. LŽ"],
      playerCount: 18,
    },
    { name: "U17", gender: "M", ageGroup: "U17", level: null, competitions: [], playerCount: 0 },
  ],
  players: [
    { ageGroup: "U13", gender: "M", count: 18 },
    { ageGroup: "U15", gender: "F", count: 10 },
    { ageGroup: "ADULTS", gender: "M", count: 22 },
  ],
  coaches: [
    {
      name: "Ján Novák",
      teams: ["Dospelí"],
      positions: ["coach"],
      licences: ["UEFA C", "UEFA B"],
      expiredLicences: ["UEFA A"],
    },
    {
      name: "Eva Kováčová",
      teams: ["U15 ženy"],
      positions: ["coach"],
      licences: ["UEFA Grassroots C"],
      expiredLicences: [],
    },
    {
      name: "Peter Malý",
      teams: ["U13"],
      positions: ["assist_coach"],
      licences: ["SFZ Fitness"],
      expiredLicences: [],
    },
  ],
};

describe("seatCoefficient", () => {
  it("follows the design's table and treats a missing population as unknown", () => {
    expect(
      [0, 99, 100, 499, 500, 1999, 2000, 9999, 10000, 29999, 30000, 49999, 50000, 1e6].map(
        seatCoefficient,
      ),
    ).toEqual([1.9, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.2, 1.1, 1.1, 1.0, 1.0]);
    expect(seatCoefficient(null)).toBeNull();
    expect(seatCoefficient(-1)).toBeNull();
  });
});

describe("bandFor", () => {
  it("uses lower bounds only, so decimals between the design's ranges keep their band", () => {
    expect(bandFor([15, 40, 80, 120], 14.9)).toBeNull();
    expect(bandFor([15, 40, 80, 120], 15)).toBe("grassroots");
    expect(bandFor([15, 40, 80, 120], 79.8)).toBe("bronze");
    expect(bandFor([15, 40, 80, 120], 120)).toBe("gold");
  });
});

describe("guessGender", () => {
  it("takes -ová / -á surnames as women", () => {
    expect(guessGender("Eva Kováčová")).toBe("F");
    expect(guessGender("Lýdia Čierniková")).toBe("F");
    expect(guessGender("Ján Novák")).toBe("M");
  });
});

describe("scoreLicensing", () => {
  it("scores areas 2–4 from Sportnet like the Vizitka design", () => {
    const r = scoreLicensing(season, { ...EMPTY_INPUTS, population: 1500 });
    expect(r.coefficient).toBe(1.5);
    expect(r.teams.teamsWithoutCompetition).toBe(1);
    // teams: (2 + 1 × 1.5) × 20 = 70, × 1.5 = 105
    expect(r.areas[0]).toMatchObject({ area: 2, points: 105, band: "bronze", status: "scored" });
    // players: (40 + 10 × 1.5) = 55, × 1.5 = 82.5
    expect(r.areas[1]).toMatchObject({ area: 3, points: 82.5, band: "silver" });
    // coaches: B 6 + GC 2 × 1.5 = 9; fitness only = 0; no coefficient
    expect(r.areas[2]).toMatchObject({ area: 4, points: 9, band: "grassroots" });
    expect(r.coaches.rows[0]).toMatchObject({ bestLicence: "UEFA B", otherLicences: ["UEFA C"] });
    expect(r.coaches.withoutLicence).toBe(1);
  });

  it("uses coefficient 1.0 without a population and applies gender corrections", () => {
    const r = scoreLicensing(season, { ...EMPTY_INPUTS, coachGender: { "Eva Kováčová": "M" } });
    expect(r).toMatchObject({ coefficient: 1, coefficientFromPopulation: false });
    expect(r.areas[0].points).toBe(70);
    expect(r.areas[2].points).toBe(8);
    expect(r.coaches.rows[1]).toMatchObject({ gender: "M", genderGuessed: false });
  });

  it("puts a club under 15 player points into no band", () => {
    const r = scoreLicensing(
      { teams: [], players: [{ ageGroup: "U09", gender: "M", count: 12 }], coaches: [] },
      EMPTY_INPUTS,
    );
    expect(r.areas[1]).toMatchObject({ points: 12, band: null, status: "noBand" });
  });

  it("scores the club's own areas 5–7", () => {
    const r = scoreLicensing(season, {
      ...EMPTY_INPUTS,
      infrastructure: { grass_105x68: 1, turf_small: 2, goals_15x1: 3, unknown: 9 },
      activities: { website: true, recruitment_events: 3, youth_tournaments: 2, veterans_40: 5 },
      cooperation: { commission_obfz: 2, school_festivals: 1, mcdonalds_cup: true },
    });
    expect(r.areas[3]).toMatchObject({ area: 5, points: 46, band: "grassroots", status: "scored" });
    expect(r.areas[4]).toMatchObject({ area: 6, points: 140, band: "grassroots" }); // 50 + 50 + 40
    expect(r.areas[5]).toMatchObject({ area: 7, points: 100, band: null, status: "unbanded" }); // 60 + 20 + 20
  });

  it("marks untouched club areas as empty, not as the lowest band", () => {
    const r = scoreLicensing(season, { ...EMPTY_INPUTS, activities: { veterans_40: 4 } });
    expect(r.areas[3]).toMatchObject({ points: 0, band: null, status: "empty" });
    expect(r.areas[4]).toMatchObject({ points: 0, band: null, status: "empty" });
  });

  it("returns zeros without season data", () => {
    const r = scoreLicensing(null, EMPTY_INPUTS);
    expect(r.areas.slice(0, 3).map((a) => a.points)).toEqual([0, 0, 0]);
    expect(r.areas[1].band).toBeNull();
  });
});
