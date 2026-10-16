import { describe, expect, it } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sampleSnapshot } from "./club-snapshot.fixture";
import { parseSnapshot } from "./club-snapshot.service";

describe("parseSnapshot", () => {
  const at = new Date("2026-10-16T10:00:00Z");

  it("maps the artifact format to clubs and seasons", () => {
    const result = parseSnapshot(sampleSnapshot, at);
    expect(result.dataAsOf).toBe("2026-10-11");
    expect(result.clubs).toEqual([
      {
        clubId: "tj-test.futbalnet.sk",
        name: "TJ Test",
        union: "ObFZ Test",
        region: "VsFZ",
        slug: "tj-test",
        source: "snapshot",
        dataAsOf: "2026-10-11",
        importedAt: at,
      },
    ]);
    const [season] = result.seasons;
    expect(season.clubId).toBe("tj-test.futbalnet.sk");
    expect(season.season).toBe("2026/2027");
    expect(season.teams[1]).toEqual({
      name: "U11 - Prípravka",
      gender: "M",
      ageGroup: "U11",
      level: null,
      competitions: [],
      playerCount: 0,
    });
    expect(season.coaches[0]).toEqual({
      name: "Ján Testovací",
      teams: ["Dospelí"],
      positions: ["coach"],
      licences: ["UEFA B"],
      expiredLicences: ["UEFA C"],
    });
    expect(season.uniquePlayers).toBe(31);
  });

  it("rejects invalid input with BAD_REQUEST", () => {
    expect(() => parseSnapshot({ fetched: "x", clubs: [] })).toThrow(ApiError);
    const badSeason = structuredClone(sampleSnapshot);
    (badSeason.clubs[0].seasons as Record<string, unknown>)["2026"] =
      badSeason.clubs[0].seasons["2026/2027"];
    expect(() => parseSnapshot(badSeason)).toThrow(/Invalid snapshot/);
  });

  it("rejects duplicate clubs", () => {
    const dup = { ...sampleSnapshot, clubs: [sampleSnapshot.clubs[0], sampleSnapshot.clubs[0]] };
    expect(() => parseSnapshot(dup)).toThrow(/Duplicate club/);
  });
});
