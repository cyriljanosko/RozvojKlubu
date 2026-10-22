import { beforeEach, describe, expect, it } from "vitest";

import {
  activityTotals,
  analyticsCsv,
  averageAreas,
  benchmarkAllowed,
  getAnalytics,
  kompasAreas,
  licensingAverages,
  sportnetTrend,
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

describe("analytics – panel shaping", () => {
  const sp = (season: string, players: number) => ({
    season,
    players,
    teams: 2,
    coaches: 1,
    coachesWithLicence: 1,
    teamsWithoutCoach: 0,
  });
  it("averages licensing over closed evaluations and sums Sportnet per season", () => {
    const lic = licensingAverages([
      { licensing: [{ key: "teams", area: 2, points: 40, band: null }] },
      { licensing: [{ key: "teams", area: 2, points: 20, band: null }] },
      { licensing: null },
    ]);
    expect(lic).toEqual({ clubs: 2, areas: [{ key: "teams", points: 30 }] });
    expect(
      sportnetTrend([
        { sportnet: [sp("2025/2026", 30), sp("2026/2027", 40)] },
        { sportnet: [sp("2026/2027", 10)] },
      ]),
    ).toEqual([
      {
        season: "2025/2026",
        players: 30,
        teams: 2,
        coaches: 1,
        coachesWithLicence: 1,
        teamsWithoutCoach: 0,
      },
      {
        season: "2026/2027",
        players: 50,
        teams: 4,
        coaches: 2,
        coachesWithLicence: 2,
        teamsWithoutCoach: 0,
      },
    ]);
    const act = (o: object) => ({
      activity: {
        kompasSubmitted: false,
        licensingClosed: false,
        visits: 0,
        actionsDone: 0,
        actionsTotal: 0,
        planGoals: 0,
        planDone: 0,
        ...o,
      },
    });
    expect(
      activityTotals([
        act({ kompasSubmitted: true, visits: 2, planGoals: 2 }),
        act({ actionsTotal: 3, actionsDone: 1 }),
      ]),
    ).toMatchObject({
      clubs: 2,
      kompasSubmitted: 1,
      withPlan: 1,
      visits: 2,
      actionsDone: 1,
      actionsTotal: 3,
    });
  });
});

describe("analytics – CSV", () => {
  const labels = {
    club: "Klub",
    clubId: "ID",
    union: "Zväz",
    size: "Veľkosť",
    sizes: { small: "malý", medium: "stredný", large: "veľký" },
    kompasSource: "Kompas",
    sources: { submitted: "odoslaný", working: "rozpracovaný" },
    area: "Oblasť",
    kompasTotal: "Spolu",
    licensingPoints: "Lic",
    visits: "V",
    actionsDone: "KS",
    actionsTotal: "K",
    goalsDone: "CS",
    goalsTotal: "C",
    players: "H",
    teams: "D",
    coaches: "T",
    coachesWithLicence: "TL",
    teamsWithoutCoach: "DB",
    average: "Priemer",
    benchmark: "Podobné",
  };
  it("writes one row per club, decimal comma, quoted names and the average row", () => {
    const csv = analyticsCsv(
      {
        scope: "all",
        season: "2026/2027",
        unions: [],
        options: [],
        clubs: [
          {
            clubId: "x1",
            name: 'FK "Sever"; B',
            union: "ObFZ X",
            size: "small",
            kompas: {
              areas: [7.5, ...Array(10).fill(null)],
              total: 7.5,
              filledAreas: 1,
              source: "working",
            },
            licensing: [{ key: "teams", area: 2, points: 40, band: null }],
            activity: {
              kompasSubmitted: false,
              licensingClosed: true,
              visits: 1,
              actionsDone: 1,
              actionsTotal: 2,
              planGoals: 0,
              planDone: 0,
            },
            sportnet: [
              {
                season: "2026/2027",
                players: 30,
                teams: 2,
                coaches: 2,
                coachesWithLicence: 1,
                teamsWithoutCoach: 0,
              },
            ],
          },
        ],
        average: { kompas: [7.5, ...Array(10).fill(null)] },
        benchmark: null,
      },
      labels,
    );
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    const header = lines[0].split(";");
    expect(header).toHaveLength(28);
    expect(lines[1].startsWith('"FK ""Sever""; B";x1;ObFZ X;malý;rozpracovaný;7,5;')).toBe(true);
    expect(lines[1].endsWith(";40;1;1;2;0;0;30;2;2;1;0")).toBe(true);
    expect(lines[2].split(";")).toHaveLength(28);
    expect(lines[2].startsWith("Priemer;;;;;7,5;")).toBe(true);
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
    expect(view.options.map((c) => c.clubId).sort()).toEqual([A, B].sort());
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
    expect(view.options.map((c) => c.clubId)).toEqual([A]);
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
