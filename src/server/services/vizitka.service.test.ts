import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import { submitKompas } from "./kompas-submission.service";
import { saveKompasAnswers } from "./kompas.service";
import { memoryEvaluationStore, memoryLicensingSubmissionStore } from "./licensing.fixture";
import { closeLicensing, saveLicensing } from "./licensing.service";
import { getClubVizitka, getPublicVizitka } from "./vizitka.service";

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
});
