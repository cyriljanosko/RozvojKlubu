import { describe, expect, it } from "vitest";

import { buildContentSeed } from "./content.service";
import {
  bandOf,
  clubCategories,
  isQuestionValid,
  scoreKompas,
  type ScoringQuestion,
} from "./kompas-scoring";

const all = buildContentSeed().questions as ScoringQuestion[];
const area = (n: number) => all.filter((q) => q.area === n);
const ids = (n: number, col: "i" | "s", orders: number[]) => orders.map((o) => `${n}.${col}.${o}`);

describe("clubCategories", () => {
  it("maps Sportnet age groups and women's teams", () => {
    expect(
      clubCategories([
        { ageGroup: "U09", gender: "M" },
        { ageGroup: "U13", gender: "M" },
        { ageGroup: "U19", gender: "M" },
        { ageGroup: "ADULTS", gender: "M" },
        { ageGroup: "U15", gender: "F" },
      ]),
    ).toEqual(["D", "Z", "DO", "S", "zd"]);
    expect(clubCategories([{ ageGroup: "ADULTS", gender: "M" }])).toEqual(["S"]);
    expect(clubCategories([{ ageGroup: "U21", gender: "M" }])).toEqual(["S"]);
    expect(clubCategories([])).toEqual([]);
  });
});

describe("isQuestionValid", () => {
  it("follows the Kompas v2 rules", () => {
    expect(isQuestionValid([], ["S"])).toBe(true);
    expect(isQuestionValid(["rast"], ["S"])).toBe(true);
    expect(isQuestionValid(["D", "Z", "DO"], ["S"])).toBe(false);
    expect(isQuestionValid(["D", "Z", "DO"], ["Z", "S"])).toBe(true);
    // a club without any age category sees every question
    expect(isQuestionValid(["D"], [])).toBe(true);
    expect(isQuestionValid(["D"], ["zd"])).toBe(true);
    expect(isQuestionValid(["zd"], ["D", "zd"])).toBe(true);
  });
});

describe("bandOf", () => {
  it("has five bands 0–4, 5–8, 9–12, 13–16, 17–20", () => {
    expect([0, 4, 5, 8, 9, 12, 13, 16, 17, 20].map((p) => bandOf(p).band)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
    expect(bandOf(12.5).key).toBe("good"); // average rounds half up
  });
});

describe("scoreKompas", () => {
  it("scores a full area 20 and an empty one as not filled", () => {
    const checked = [
      ...ids(1, "i", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      ...ids(1, "s", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ];
    const r = scoreKompas(area(1).concat(area(2)), ["D", "Z", "DO", "S"], checked);
    expect(r.areas[0]).toMatchObject({ area: 1, points: 20, band: "model", status: "scored" });
    expect(r.areas[1]).toMatchObject({ area: 2, points: null, status: "empty", filled: false });
    expect(r).toMatchObject({ filledAreas: 1, total: 20, average: 20, band: "model" });
  });

  it("rounds column points over valid questions only", () => {
    // adults-only club: area 5 column i has many youth-only questions
    const qs = area(3);
    const validI = qs.filter((q) => q.column === "i" && isQuestionValid(q.tags, ["S"]));
    const r = scoreKompas(qs, ["S"], [validI[0].questionId, `3.s.1`]);
    const col = r.areas[0].columns.i;
    expect(col.valid).toBe(validI.length);
    expect(col.points).toBe(Math.round((1 / validI.length) * 10));
  });

  it("does not score an area with fewer than 3 valid questions in a column", () => {
    // area 5 column i: almost all questions are tagged for youth categories
    const r = scoreKompas(area(5), ["S"], ["5.s.1"]);
    expect(r.areas[0].columns.i.valid).toBeLessThan(3);
    expect(r.areas[0]).toMatchObject({ status: "few", points: null, band: null });
    expect(r.filledAreas).toBe(0);
  });

  it("lists the three weakest areas with unchecked valid questions as tasks", () => {
    const qs = [1, 2, 3, 4].flatMap(area);
    const checked = [
      ...ids(1, "i", [1, 2, 3, 4, 5, 6, 7, 8]),
      ...ids(1, "s", [1, 2, 3, 4, 5, 6, 7, 8]),
      ...ids(2, "i", [1]),
      ...ids(3, "i", [1, 2]),
      ...ids(4, "i", [1, 2, 3]),
    ];
    const r = scoreKompas(qs, ["D", "Z", "DO", "S"], checked);
    expect(r.next.map((n) => n.area)).toEqual([2, 3, 4]);
    expect(r.next[0].tasks.map((t) => t.questionId)).toEqual(["2.i.2", "2.i.3", "2.i.4"]);
  });
});
