import { describe, expect, it } from "vitest";

import { sampleSnapshot } from "./club-snapshot.fixture";
import { parseSnapshot } from "./club-snapshot.service";
import { buildContentSeed } from "./content.service";
import { kompasLine, profileFromSeason, sizeLabel } from "./kompas-export";
import { scoreKompas, type ScoringQuestion } from "./kompas-scoring";

const questions = buildContentSeed().questions as ScoringQuestion[];

describe("profileFromSeason", () => {
  it("derives the profile from Sportnet season data", () => {
    const season = parseSnapshot(sampleSnapshot).seasons[0];
    expect(profileFromSeason(season)).toEqual({
      teams: 2,
      youth: 9,
      adults: 22,
      girls: 9,
      coaches: 1,
      womenCoaches: null,
      schools: null,
      teamsWithoutCoach: 1, // U11 has no coach
    });
    expect(profileFromSeason(null).teams).toBe(0);
  });
});

describe("kompasLine", () => {
  // cleaning is the same as Kompas v2 (| and newlines → one space, no space collapsing)
  it("matches the SFZ-KOMPAS-1 format of Kompas v2/v13", () => {
    const checked = [
      ...Array.from({ length: 7 }, (_, i) => `1.i.${i + 1}`),
      ...Array.from({ length: 5 }, (_, i) => `1.s.${i + 1}`),
    ];
    const result = scoreKompas(questions, ["D", "Z", "DO", "S"], checked);
    const line = kompasLine({
      clubName: "TJ X | test\n",
      union: "ObFZ Trebišov",
      region: "VsFZ",
      season: "2026/2027",
      result,
      profile: {
        teams: 6,
        youth: 70,
        adults: 30,
        girls: 5,
        coaches: 8,
        womenCoaches: null,
        schools: null,
        teamsWithoutCoach: 0,
      },
    });
    expect(line).toBe(
      "SFZ-KOMPAS-1|TJ X   test|ObFZ Trebišov|VsFZ|2026/2027|stredný|7-5,-,-,-,-,-,-,-,-,-,-|6;70;5;8;;;30;0",
    );
  });

  it("uses the Kompas size thresholds", () => {
    expect([sizeLabel(50, 29), sizeLabel(50, 30), sizeLabel(150, 50)]).toEqual([
      "malý",
      "stredný",
      "veľký",
    ]);
  });
});
