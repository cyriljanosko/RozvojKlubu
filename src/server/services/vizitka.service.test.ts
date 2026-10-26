import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import {
  confirmKompasSubmission,
  submitKompas,
  withdrawKompasSubmission,
} from "./kompas-submission.service";
import { saveKompasAnswers } from "./kompas.service";
import { memoryEvaluationStore, memoryLicensingSubmissionStore } from "./licensing.fixture";
import { closeLicensing, reopenLicensing, saveLicensing } from "./licensing.service";
import { getClubVizitka, getPublicVizitka } from "./vizitka.service";
import { listVizitky, milestonesOf, type RankingsDeps } from "./vizitky.service";
import { memoryPlanStore } from "./club-plan.fixture";
import { memoryClubSettingsStore } from "./club-settings.fixture";
import { setRankingConsent } from "./club-settings.service";
import { memoryVisitStore } from "./mentor-visit.fixture";
import type { StoredVisit } from "./mentor-visit.service";
import type { CurrentUser } from "./users.service";

const carl = { id: "carl", email: "carl@iny.sk", name: "Carl", role: "public" as const };

async function setup() {
  const base = memoryDeps();
  const people = [admin, alice, bob, carl];
  base.users.findByEmail = async (e) => people.find((p) => p.email === e) ?? null;
  base.users.findById = async (id) => people.find((p) => p.id === id) ?? null;
  const content = memoryContentStore();
  await seedContent(content, admin);
  const deps = {
    ...base,
    content,
    assessments: memoryAssessmentStore(),
    submissions: memorySubmissionStore(),
    evaluations: memoryEvaluationStore(),
    licensingSubmissions: memoryLicensingSubmissionStore(),
  };
  await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
  await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
  return deps;
}

const emptyInputs = {
  population: null,
  infrastructure: {},
  activities: {},
  cooperation: {},
  coachGender: {},
};

describe("Vizitka klubu", () => {
  let deps: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    deps = await setup();
  });

  it("shows the public profile and 'not yet' parts before anything is submitted or closed", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 }); // draft only
    const v = await getPublicVizitka(deps, A);
    expect(v).toMatchObject({
      club: { clubId: A, name: "TJ Test" },
      season: "2026/2027",
      profile: { size: "small", teams: 2, players: 31, coaches: 1 },
      kompas: null,
      licensing: null,
    });
  });

  it("shows area results of the last submitted Kompas and the closed licensing evaluation", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    await submitKompas(deps, alice, A, { expectedVersion: 1 });
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1", "3.i.2"], expectedVersion: 1 }); // newer draft
    await saveLicensing(deps, alice, A, {
      season: "2026/2027",
      inputs: { ...emptyInputs, population: 1500 },
      expectedVersion: 0,
    });
    await closeLicensing(deps, alice, A, { season: "2026/2027", expectedVersion: 1 });

    const v = await getPublicVizitka(deps, A, "2026/2027");
    expect(v.kompas?.areas).toHaveLength(11);
    const area3 = v.kompas!.areas.find((a) => a.area === 3)!;
    expect(area3).toMatchObject({ name: "Tréneri", status: "scored" });
    expect(v.kompas!.filledAreas).toBe(1);
    expect(v.licensing!.areas.map((a) => a.points)).toEqual([30, 53.25, 6, 0, 0, 0]);
    // public view carries no dates, names or coefficient
    const json = JSON.stringify(v);
    expect(json).not.toContain("Ján Testovací");
    expect(v).not.toHaveProperty("kompasSubmittedAt");
    expect(v).not.toHaveProperty("licensingCoefficient");

    const club = await getClubVizitka(deps, bob, A);
    expect(club).toMatchObject({
      licensingCoefficient: 1.5,
      drafts: { kompasVersion: 2, licensingVersion: 1 },
    });
    expect(club.kompasSubmittedAt).toBeInstanceOf(Date);
    expect(club.licensingClosedAt).toBeInstanceOf(Date);
  });

  it("lets only club roles and admin open the club view; isolates clubs", async () => {
    await expect(getClubVizitka(deps, carl, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubVizitka(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(getClubVizitka(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getClubVizitka(deps, admin, A)).club.clubId).toBe(A);
    await expect(getPublicVizitka(deps, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPublicVizitka(deps, A, "2019/2020")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("ignores a reopened licensing closing", async () => {
    await saveLicensing(deps, alice, A, {
      season: "2026/2027",
      inputs: emptyInputs,
      expectedVersion: 0,
    });
    await closeLicensing(deps, alice, A, { season: "2026/2027", expectedVersion: 1 });
    expect((await getPublicVizitka(deps, A)).licensing).not.toBeNull();
    await reopenLicensing(deps, admin, A, { season: "2026/2027" });
    expect((await getPublicVizitka(deps, A)).licensing).toBeNull();
    expect((await getClubVizitka(deps, alice, A)).licensingClosedAt).toBeNull();
  });

  it("ignores a withdrawn Kompas submission", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 1 });
    expect((await getPublicVizitka(deps, A)).kompas).not.toBeNull();
    await withdrawKompasSubmission(deps, admin, A, sub.id);
    expect((await getPublicVizitka(deps, A)).kompas).toBeNull();
    expect((await getClubVizitka(deps, alice, A)).kompasSubmittedAt).toBeNull();
  });
});

describe("Vizitky – public list and motivational rankings (VK-a, VK-b, MR-b)", () => {
  const mona = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" as const };

  async function rankingSetup() {
    const deps = await setup();
    const people = [admin, alice, bob, carl, mona];
    deps.users.findByEmail = async (e) => people.find((p) => p.email === e) ?? null;
    deps.users.findById = async (id) => people.find((p) => p.id === id) ?? null;
    await addClubMember(deps, admin, A, { email: "mona@obfz.sk", role: "mentor" });
    const settings = memoryClubSettingsStore();
    const plans = memoryPlanStore();
    const visits = memoryVisitStore();
    return { ...deps, settings, plans, visits };
  }
  const cardOf = async (deps: RankingsDeps, clubId: string, actor: CurrentUser | null = null) =>
    (await listVizitky(deps, actor)).cards.find((c) => c.clubId === clubId)!;

  it("lists every club; without consent neutrally – no stars, points or milestones", async () => {
    const deps = await rankingSetup();
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    await submitKompas(deps, alice, A, { expectedVersion: 1 });
    const { cards } = await listVizitky(deps);
    expect(cards.map((c) => c.clubId).sort()).toEqual([A, B].sort());
    expect(cards.find((c) => c.clubId === A)).toMatchObject({
      name: "TJ Test",
      size: "small",
      players: 31,
      place: null, // test clubs are not in the district table
      ranked: false,
      kompas: null,
      kompasStars: null,
      licensing: null,
      confirmed: false,
      progress: null,
      milestones: [],
    });
  });

  it("with consent: stars, licensing, mentor's confirmation and the season's milestones", async () => {
    const deps = await rankingSetup();
    await setRankingConsent(deps, alice, A, { given: true, expectedVersion: 0 });
    let card = await cardOf(deps, A);
    expect(card).toMatchObject({ ranked: true, kompasStars: null, milestones: [] });

    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 1 });
    await confirmKompasSubmission(deps, mona, A, sub.id, true);
    await saveLicensing(deps, alice, A, {
      season: "2026/2027",
      inputs: emptyInputs,
      expectedVersion: 0,
    });
    await closeLicensing(deps, alice, A, { season: "2026/2027", expectedVersion: 1 });
    deps.plans.docs.push({
      clubId: A,
      season: "2026/2027",
      goals: [
        {
          id: "g1",
          area: 3,
          title: "Dvaja noví tréneri",
          publicText: "",
          indicator: "",
          owner: "Alice",
          ownerId: "alice",
          dueDate: null,
          status: "done",
          doneAt: new Date(),
        },
      ],
      confirmedAt: null,
      confirmedBy: null,
      editedAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "alice",
    });
    deps.visits.docs.push(
      { ...(await visitDoc()), id: "v1", season: "2026/2027", status: "planned" },
      { ...(await visitDoc()), id: "v2", season: "2025/2026", status: "sent" },
    );
    card = await cardOf(deps, A);
    expect(card.kompasStars).toBe(1); // a few points – the first band
    expect(card.licensing?.stars).toBeGreaterThanOrEqual(1);
    expect(card.confirmed).toBe(true);
    // a planned visit and last season's visit do not count
    expect(card.milestones).toEqual(["kompas", "confirmed", "plan", "goal", "licensing"]);
    deps.visits.docs.push({ ...(await visitDoc()), id: "v3", season: "2026/2027", status: "sent" });
    expect((await cardOf(deps, A)).milestones).toContain("visit");

    // withdrawing the consent hides it all again
    await setRankingConsent(deps, alice, A, { given: false, expectedVersion: 1 });
    expect(await cardOf(deps, A)).toMatchObject({
      ranked: false,
      kompasStars: null,
      milestones: [],
    });
  });

  it("progress: this season's Kompas against the last one of the previous season", async () => {
    const deps = await rankingSetup();
    await setRankingConsent(deps, alice, A, { given: true, expectedVersion: 0 });
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 1 });
    expect((await cardOf(deps, A)).progress).toBeNull(); // nothing last season
    const current = deps.submissions.docs.find((d) => d.id === sub.id)!;
    deps.submissions.docs.push({
      ...structuredClone(current),
      id: "old",
      season: "2025/2026",
      result: { ...current.result, total: 0 },
    });
    expect((await cardOf(deps, A)).progress).toEqual({
      points: sub.total,
      fromStars: 0,
      toStars: 1,
    });
  });

  it("the viewer: admin sees every position, mentor their clubs, the club its own", async () => {
    const deps = await rankingSetup();
    expect((await listVizitky(deps)).viewer).toEqual({ positions: [], own: [] });
    expect((await listVizitky(deps, admin)).viewer).toEqual({ positions: "all", own: [] });
    expect((await listVizitky(deps, mona)).viewer).toEqual({ positions: [A], own: [] });
    expect((await listVizitky(deps, alice)).viewer).toEqual({ positions: [A], own: [A] });
    expect((await listVizitky(deps, carl)).viewer).toEqual({ positions: [], own: [] });
  });

  it("milestones are pure and ordered", () => {
    expect(
      milestonesOf({
        kompas: true,
        confirmed: false,
        goals: [{ status: "doing" }],
        sentVisit: true,
        licensing: false,
      }),
    ).toEqual(["kompas", "plan", "visit"]);
    expect(
      milestonesOf({
        kompas: false,
        confirmed: false,
        goals: [],
        sentVisit: false,
        licensing: false,
      }),
    ).toEqual([]);
  });
});

/** a sent visit of club A – only `season` and `status` matter for the milestones */
async function visitDoc(): Promise<StoredVisit> {
  return {
    id: "v",
    clubId: A,
    season: "2026/2027",
    date: "2026-10-01",
    form: "onsite",
    participantIds: [],
    participants: "",
    summary: "",
    topics: [],
    assessment: null,
    prepTask: null,
    findings: [],
    actions: [],
    status: "sent",
    sentAt: new Date(),
    withdrawnAt: null,
    withdrawnBy: null,
    version: 1,
    createdBy: "mona",
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedBy: "mona",
  };
}
