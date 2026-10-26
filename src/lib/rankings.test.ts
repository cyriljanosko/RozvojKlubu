import { describe, expect, it } from "vitest";

import {
  kompasProgress,
  kompasStars,
  licensingStars,
  positionOf,
  previousSeason,
  sortClubs,
  topProgress,
  topThree,
  unionRatings,
  type RankedClub,
} from "./rankings";

const club = (o: Partial<RankedClub> & { name: string }): RankedClub => ({
  clubId: o.name,
  place: null,
  players: null,
  kompas: null,
  kompasStars: kompasStars(o.kompas ?? null),
  licensing: null,
  ...o,
});

describe("rankings – stars", () => {
  it("Kompas: five bands of 44 points, nothing submitted = no stars", () => {
    expect([0, 1, 44, 45, 88, 89, 132, 133, 176, 177, 220].map(kompasStars)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
    expect(kompasStars(null)).toBeNull();
  });

  it("licensing: average band of the banded areas, rounded", () => {
    expect(
      licensingStars([
        { band: "gold", status: "scored" },
        { band: "silver", status: "scored" },
        { band: null, status: "unbanded" },
      ]),
    ).toBe(5); // (5 + 4) / 2 = 4.5
    expect(
      licensingStars([
        { band: null, status: "empty" },
        { band: null, status: "noBand" },
        { band: "bronze", status: "scored" },
      ]),
    ).toBe(2); // (1 + 1 + 3) / 3
    expect(licensingStars([{ band: null, status: "unbanded" }])).toBeNull();
  });
});

describe("rankings – order", () => {
  const a = club({
    name: "Alfa",
    kompas: 150,
    players: 80,
    licensing: { points: 300, stars: 3 },
    place: { district: "Nitra", obfz: "ObFZ Nitra", rfz: "ZsFZ" },
  });
  const b = club({
    name: "Beta",
    kompas: 170,
    players: 300,
    licensing: { points: 200, stars: 3 },
    place: { district: "Košice I", obfz: "ObFZ Košice", rfz: "VsFZ" },
  });
  const c = club({ name: "Cé", players: 120, licensing: { points: 500, stars: 5 } });
  const names = (list: RankedClub[]) => list.map((x) => x.name);

  it("sorts by Kompas, licensing, members, ObFZ and RFZ with missing values last", () => {
    expect(names(sortClubs([c, a, b], "kompas"))).toEqual(["Beta", "Alfa", "Cé"]);
    expect(names(sortClubs([a, b, c], "licensing"))).toEqual(["Cé", "Alfa", "Beta"]);
    expect(names(sortClubs([a, b, c], "players"))).toEqual(["Beta", "Cé", "Alfa"]);
    expect(names(sortClubs([c, b, a], "obfz"))).toEqual(["Beta", "Alfa", "Cé"]);
    expect(names(sortClubs([c, b, a], "rfz"))).toEqual(["Beta", "Alfa", "Cé"]);
  });

  it("averages the stars per union, clubs without a place are left out", () => {
    const d = club({
      name: "Delta",
      kompas: 40,
      place: { district: "Nitra", obfz: "ObFZ Nitra", rfz: "ZsFZ" },
    });
    expect(unionRatings([a, b, c, d], "rfz")).toEqual([
      { id: "VsFZ", clubs: 1, kompas: 4, licensing: 3 },
      { id: "ZsFZ", clubs: 2, kompas: 2.5, licensing: 3 },
    ]);
  });
});

describe("rankings – public top 3, progress and positions (MR-b, ADR 0015)", () => {
  const list = [80, 200, null, 150, 120, 10].map((kompas, i) =>
    club({ name: `K${i}`, kompas, licensing: i === 0 ? { points: 9, stars: 4 } : null }),
  );

  it("top 3 only from clubs with a value, fewer when fewer have one", () => {
    expect(topThree(list, "kompas").map((c) => c.name)).toEqual(["K1", "K3", "K4"]);
    expect(topThree(list, "players").map((c) => c.name)).toEqual(["K1", "K3", "K4"]); // ranks by Kompas
    expect(topThree(list, "licensing").map((c) => c.name)).toEqual(["K0"]);
  });

  it("position among the clubs with a value; null without one", () => {
    expect(positionOf(list, "K4", "kompas")).toEqual({ position: 3, of: 5 });
    expect(positionOf(list, "K2", "kompas")).toBeNull();
  });

  it("progress against the previous season; top 3 only of clubs that improved", () => {
    expect(previousSeason("2026/2027")).toBe("2025/2026");
    expect(kompasProgress(40, 100)).toEqual({ points: 60, fromStars: 1, toStars: 3 });
    expect(kompasProgress(null, 100)).toBeNull();
    const withProgress = [
      { ...club({ name: "Up" }), progress: kompasProgress(40, 100) },
      { ...club({ name: "Down" }), progress: kompasProgress(100, 40) },
      { ...club({ name: "New" }), progress: null },
      { ...club({ name: "Bit" }), progress: kompasProgress(40, 45) },
    ];
    expect(topProgress(withProgress).map((c) => c.name)).toEqual(["Up", "Bit"]);
  });
});
