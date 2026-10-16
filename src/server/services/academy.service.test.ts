import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { memoryChoiceStore } from "./academy.fixture";
import {
  clubTasks,
  getMyAcademy,
  mentorTasks,
  practiceRoleFor,
  roleOptions,
  saveAreaRoleChoice,
  type AcademyDeps,
} from "./academy.service";
import { A, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore, memoryRoleCatalogStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import { submitKompas } from "./kompas-submission.service";
import { saveKompasAnswers } from "./kompas.service";
import { memoryEvaluationStore, memoryLicensingSubmissionStore } from "./licensing.fixture";
import { roleCatalogSchema } from "./role-catalog.schema";
import { seedRoleCatalog } from "./role-catalog.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8"));
const catalog = roleCatalogSchema.parse(file);
const mona = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" as const };

const emptyResult = { filledAreas: 0, next: [], areas: [] };

describe("clubTasks", () => {
  it("asks management to fill in, send and close; coach gets areas 3 and 5", () => {
    const base = {
      clubId: A,
      kompasVersion: 0,
      kompasResult: emptyResult,
      kompasUnsent: true,
      licensingClosed: false,
      teamsWithoutCoach: 1,
    };
    expect(clubTasks({ ...base, roles: ["management"] }).map((t) => t.key)).toEqual([
      "kompas_empty",
      "licensing_open",
      "teams_without_coach",
    ]);
    const filled = {
      ...base,
      kompasVersion: 3,
      licensingClosed: true,
      teamsWithoutCoach: 0,
      kompasResult: {
        filledAreas: 2,
        next: [{ area: 7, points: 4, tasks: [] }],
        areas: [
          { area: 3, points: 12 },
          { area: 5, points: 6 },
        ] as never,
      },
    };
    expect(clubTasks({ ...filled, roles: ["management"] })).toEqual([
      { key: "kompas_unsent", severity: "warn", href: `/klub/${A}/kompas` },
      { key: "weak_area", severity: "info", href: "/oblasti/7?tab=prax", area: 7, points: 4 },
    ]);
    expect(clubTasks({ ...filled, kompasUnsent: false, roles: ["coach"] })).toEqual([
      { key: "weak_area", severity: "info", href: "/oblasti/5?tab=prax", area: 5, points: 6 },
    ]);
  });
});

describe("mentorTasks", () => {
  it("summarises clubs without a submitted Kompas or a closed season", () => {
    const tasks = mentorTasks([
      { clubId: "x", name: "X", latest: null, licensingClosed: false },
      { clubId: "y", name: "Y", latest: {} as never, licensingClosed: false },
      { clubId: "z", name: "Z", latest: null, licensingClosed: true },
    ]);
    expect(tasks.map((t) => [t.key, t.count, t.clubName])).toEqual([
      ["club_kompas_missing", 2, "X, Z"],
      ["club_licensing_open", 2, "X, Y"],
    ]);
    expect(
      mentorTasks([{ clubId: "y", name: "Y", latest: {} as never, licensingClosed: true }]),
    ).toEqual([]);
  });
});

describe("roleOptions", () => {
  it("offers roles of the user's base roles only", () => {
    const coach = roleOptions(catalog, ["coach"]);
    expect(coach.find((o) => o.area === 3 && o.key === "new_coach")).toBeTruthy();
    expect(coach.some((o) => o.key === "economist")).toBe(false);
    expect(roleOptions(catalog, ["management"]).filter((o) => o.area === 8)).toHaveLength(5);
  });
});

async function setup(): Promise<AcademyDeps> {
  const base = memoryDeps();
  const people = [admin, alice, bob, mona];
  base.users.findByEmail = async (e) => people.find((p) => p.email === e) ?? null;
  base.users.findById = async (id) => people.find((p) => p.id === id) ?? null;
  const content = memoryContentStore();
  await seedContent(content, admin);
  const roleCatalog = memoryRoleCatalogStore(memoryContentStore());
  await seedRoleCatalog(roleCatalog, admin, file);
  const deps: AcademyDeps = {
    ...base,
    content,
    assessments: memoryAssessmentStore(),
    submissions: memorySubmissionStore(),
    evaluations: memoryEvaluationStore(),
    licensingSubmissions: memoryLicensingSubmissionStore(),
    roleCatalog,
    choices: memoryChoiceStore(),
  };
  await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
  await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
  await addClubMember(deps, admin, A, { email: "mona@obfz.sk", role: "mentor" });
  return deps;
}

describe("getMyAcademy", () => {
  let deps: AcademyDeps;
  beforeEach(async () => {
    deps = await setup();
  });

  it("shows management the club, its standing and tasks", async () => {
    const view = await getMyAcademy(deps, alice);
    expect(view.mentor).toBeNull();
    expect(view.clubs).toHaveLength(1);
    expect(view.clubs[0]).toMatchObject({
      clubId: A,
      roles: ["management"],
      baseRoleNames: ["Manažér a výbor"],
      kompas: { version: 0, filledAreas: 0, submittedAt: null },
      licensingClosedAt: null,
    });
    expect(view.clubs[0].tasks.map((t) => t.key)).toContain("kompas_empty");

    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    expect((await getMyAcademy(deps, alice)).clubs[0].tasks.map((t) => t.key)).toContain(
      "kompas_unsent",
    );
    await submitKompas(deps, alice, A, { expectedVersion: 1 });
    expect((await getMyAcademy(deps, alice)).clubs[0].tasks.map((t) => t.key)).not.toContain(
      "kompas_unsent",
    );
  });

  it("gives the mentor the cohort with tasks and no own club section", async () => {
    const view = await getMyAcademy(deps, mona);
    expect(view.clubs).toHaveLength(0);
    expect(view.mentor?.rows.map((r) => r.clubId)).toEqual([A]);
    expect(view.mentor?.tasks.map((t) => t.key)).toEqual([
      "club_kompas_missing",
      "club_licensing_open",
    ]);
  });

  it("saves own roles in the areas and uses them for the Prax default", async () => {
    await expect(
      saveAreaRoleChoice(deps, bob, A, { roles: ["8.economist"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(saveAreaRoleChoice(deps, mona, A, { roles: [] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      await saveAreaRoleChoice(deps, bob, A, { roles: ["3.new_coach", "3.new_coach"] }),
    ).toEqual(["3.new_coach"]);
    expect((await getMyAcademy(deps, bob)).clubs[0].chosenRoles).toEqual(["3.new_coach"]);
    expect(await practiceRoleFor(deps, bob, 3)).toBe("n");
    expect(await practiceRoleFor(deps, bob, 4)).toBeNull();
  });
});
