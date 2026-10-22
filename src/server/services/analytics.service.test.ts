import { beforeEach, describe, expect, it } from "vitest";

import {
  averageAreas,
  benchmarkAllowed,
  getAnalytics,
  kompasAreas,
  type AnalyticsDeps,
} from "./analytics.service";
import { memoryPlanStore } from "./club-plan.fixture";
import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import { submitKompas } from "./kompas-submission.service";
import { saveKompasAnswers } from "./kompas.service";
import { memoryLicensingSubmissionStore } from "./licensing.fixture";
import { memoryVisitStore } from "./mentor-visit.fixture";
import type { CurrentUser } from "./users.service";

const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };

describe("analytics – pure", () => {
  it("averages areas ignoring missing values, one decimal", () => {
    expect(
      averageAreas(
        [
          [10, null, 4],
          [5, null, 5],
          [null, null, 6],
        ],
        3,
      ),
    ).toEqual([7.5, null, 5]);
    expect(averageAreas([], 2)).toEqual([null, null]);
  });

  it("needs at least 3 clubs for an anonymous average", () => {
    expect(benchmarkAllowed(2)).toBe(false);
    expect(benchmarkAllowed(3)).toBe(true);
  });

  it("maps a Kompas result to areas 1–11", () => {
    const areas = kompasAreas({
      areas: [
        { area: 3, points: 12 },
        { area: 11, points: 4 },
      ],
    } as never);
    expect(areas).toHaveLength(11);
    expect(areas[2]).toBe(12);
    expect(areas[10]).toBe(4);
    expect(areas[0]).toBeNull();
    expect(kompasAreas(null).every((a) => a === null)).toBe(true);
  });
});

describe("analytics – scope by role", () => {
  let deps: AnalyticsDeps;
  beforeEach(async () => {
    const base = memoryDeps();
    const content = memoryContentStore();
    await seedContent(content, admin);
    const submissions = memorySubmissionStore();
    const assessments = memoryAssessmentStore();
    deps = {
      ...base,
      kompas: { ...base, content, assessments },
      submissions,
      licensingSubmissions: memoryLicensingSubmissionStore(),
      visits: memoryVisitStore(),
      plans: memoryPlanStore(),
    };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    base.memberDocs.push({
      id: "m1",
      userId: mona.id,
      clubId: A,
      role: "mentor",
      season: "2026/2027",
      ageGroups: [],
      createdBy: admin.id,
      createdAt: new Date(),
    });
    // a working Kompas for A (not submitted yet)
    await saveKompasAnswers({ ...base, content, assessments }, alice, A, {
      answers: ["3.i.1", "3.i.2", "3.s.1"],
      expectedVersion: 0,
    });
  });

  it("admin sees all clubs with the working Kompas and an average", async () => {
    const view = await getAnalytics(deps, admin);
    expect(view.scope).toBe("all");
    expect(view.clubs.map((c) => c.clubId).sort()).toEqual([A, B].sort());
    const a = view.clubs.find((c) => c.clubId === A)!;
    expect(a.kompas.source).toBe("working");
    expect(a.sportnet.length).toBeGreaterThan(0);
    expect(view.average?.kompas).toHaveLength(11);
    expect(view.benchmark).toBeNull();
    // filters
    expect((await getAnalytics(deps, admin, { clubs: [B] })).clubs.map((c) => c.clubId)).toEqual([
      B,
    ]);
  });

  it("the mentor sees the cohort with the submitted Kompas only", async () => {
    let view = await getAnalytics(deps, mona);
    expect(view.scope).toBe("mentor");
    expect(view.clubs.map((c) => c.clubId)).toEqual([A]);
    expect(view.clubs[0].kompas).toMatchObject({ source: null, total: null });
    await submitKompas({ ...deps.kompas, submissions: deps.submissions as never }, alice, A, {
      expectedVersion: 1,
    });
    view = await getAnalytics(deps, mona);
    expect(view.clubs[0].kompas.source).toBe("submitted");
    expect(view.clubs[0].activity.kompasSubmitted).toBe(true);
  });

  it("club roles see their own club and no average of fewer than 3 clubs", async () => {
    const view = await getAnalytics(deps, bob);
    expect(view).toMatchObject({ scope: "club", average: null, benchmark: null });
    expect(view.clubs.map((c) => c.clubId)).toEqual([A]);
    expect(view.clubs[0].kompas.source).toBe("working");
    const nobody: CurrentUser = { id: "x", email: "x@x.sk", name: "X", role: "public" };
    await expect(getAnalytics(deps, nobody)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getAnalytics(deps, null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("club roles get an anonymous average of 3+ same-size clubs, without their names", async () => {
    const extra = ["c1", "c2", "c3"].map((id) => ({
      clubId: id,
      name: `Tajný ${id}`,
      union: "ObFZ X",
    }));
    const seasonA = (await deps.clubs.findSeason(A, (await deps.clubs.listSeasonNames(A))[0]))!;
    const clubs = deps.clubs;
    deps.clubs = {
      ...clubs,
      listClubs: async (ids) => [
        ...(await clubs.listClubs(ids)),
        ...(ids === "all" ? (extra as never[]) : []),
      ],
      listSeasonNames: async (id) =>
        id.startsWith("c") ? [seasonA.season] : clubs.listSeasonNames(id),
      findSeason: async (id, season) =>
        id.startsWith("c") ? { ...seasonA, clubId: id } : clubs.findSeason(id, season),
    };
    const list = deps.submissions.listSubmissions;
    deps.submissions = {
      listSubmissions: async (clubId, season) =>
        clubId.startsWith("c")
          ? ([
              {
                status: "submitted",
                submittedAt: new Date(),
                result: { areas: [{ area: 1, points: clubId === "c1" ? 6 : 9 }] },
              },
            ] as never)
          : list(clubId, season),
    };
    const view = await getAnalytics(deps, alice);
    expect(view.benchmark).toMatchObject({ clubs: 3 });
    expect(view.benchmark?.kompas[0]).toBe(8);
    expect(JSON.stringify(view)).not.toContain("Tajný");
  });
});
