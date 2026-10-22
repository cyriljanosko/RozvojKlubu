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
  splitTasks,
  practiceInput,
  type AcademyDeps,
} from "./academy.service";
import { A, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore, memoryPracticeStore, memoryRoleCatalogStore } from "./content.fixture";
import { memoryPlanStore } from "./club-plan.fixture";
import { memoryVisitStore } from "./mentor-visit.fixture";
import { memoryProgressStore } from "./practice-progress.fixture";
import { savePracticeProgress } from "./practice-progress.service";
import { seedPractice } from "./practice.service";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import { submitKompas } from "./kompas-submission.service";
import { saveKompasAnswers } from "./kompas.service";
import { memoryEvaluationStore, memoryLicensingSubmissionStore } from "./licensing.fixture";
import { roleCatalogSchema } from "./role-catalog.schema";
import { seedRoleCatalog } from "./role-catalog.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8"));
const catalog = roleCatalogSchema.parse(file);
const prax3 = JSON.parse(readFileSync(join(process.cwd(), "content/prax/03.json"), "utf8"));
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
    practice: memoryPracticeStore(memoryContentStore()),
    progress: memoryProgressStore(),
    visits: memoryVisitStore(),
    plans: memoryPlanStore(),
  };
  await seedPractice(deps.practice as ReturnType<typeof memoryPracticeStore>, admin, [prax3]);
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

  it("gives the dashboard tiles their data: Kompas by area, visits, plan; admin all clubs (MD-b)", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    const club = (await getMyAcademy(deps, alice)).clubs[0];
    expect(club.kompas?.areas).toHaveLength(11);
    expect(club.kompas?.areas[2]).toBeGreaterThan(0);
    expect(club.visits).toEqual({ lastDate: null, open: 0, overdue: 0 });
    expect(club.plan).toMatchObject({ goals: 0, done: 0 });
    expect(club.planGoals).toEqual([]);
    expect((await getMyAcademy(deps, alice)).admin).toBeNull();
    const all = await getMyAcademy(deps, admin);
    expect(all.admin?.rows.map((r) => r.clubId)).toContain(A);
    expect(all.admin?.rows[0].visits).toMatchObject({ open: 0 });
  });

  it("adds the Prax task of the user's role once the club has started (F6d)", async () => {
    const keys = async (u: typeof alice) =>
      (await getMyAcademy(deps, u)).clubs[0].tasks.map((t) => t.key);
    expect(await keys(alice)).not.toContain("practice_first");
    await savePracticeProgress(
      { ...deps, practice: deps.practice, progress: deps.progress } as never,
      alice,
      A,
      3,
      { tasks: ["v1"], steps: [], expectedVersion: 0 },
    );
    const task = (await getMyAcademy(deps, alice)).clubs[0].tasks.find(
      (t) => t.key === "practice_first",
    );
    expect(task).toMatchObject({ area: 3, href: expect.stringContaining("role=v") });
    // the coach has their own role "t" in the shared record – nothing started yet
    expect(await keys(bob)).not.toContain("practice_first");
  });

  it("gives the mentor the cohort with tasks and no own club section", async () => {
    const view = await getMyAcademy(deps, mona);
    expect(view.clubs).toHaveLength(0);
    expect(view.mentor?.rows.map((r) => r.clubId)).toEqual([A]);
    expect(view.mentor?.rows[0].visits).toEqual({ lastDate: null, open: 0, overdue: 0 });
    expect(view.mentor?.tasks.map((t) => t.key)).toEqual([
      "club_kompas_missing",
      "club_licensing_open",
      "club_no_plan",
      "club_no_visit",
    ]);
  });

  it("shows agreed actions to the responsible member and to management (MV-c)", async () => {
    const visit = await (deps.visits as ReturnType<typeof memoryVisitStore>).insertVisit({
      clubId: A,
      season: "2026/2027",
      date: "2026-10-01",
      form: "onsite",
      participantIds: [],
      participants: "",
      summary: "",
      findings: [],
      actions: [
        {
          id: "a1",
          text: "Osloviť rodičov",
          area: 3,
          owner: "Bob",
          ownerId: "bob",
          dueDate: "2026-10-10",
          done: false,
          doneAt: null,
          doneBy: null,
        },
        {
          id: "a2",
          text: "Poďakovať",
          area: null,
          owner: "Výbor",
          ownerId: null,
          dueDate: null,
          done: false,
          doneAt: null,
          doneBy: null,
        },
      ],
      status: "sent",
      sentAt: new Date(),
      withdrawnAt: null,
      withdrawnBy: null,
      version: 2,
      createdBy: "mona",
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "mona",
    });
    const tasks = async (u: typeof alice) =>
      (await getMyAcademy(deps, u)).clubs[0].tasks.filter((t) => t.key === "visit_action");
    // memoryDeps "now" is 2026-10-16 → a1 is overdue
    expect(await tasks(bob)).toEqual([
      expect.objectContaining({
        step: "Osloviť rodičov",
        severity: "crit",
        due: { date: "2026-10-10", overdue: true },
        href: `/klub/${encodeURIComponent(A)}/navstevy/${visit.id}`,
      }),
    ]);
    expect((await tasks(alice)).map((t) => t.step)).toEqual(["Osloviť rodičov", "Poďakovať"]);
    const mentor = (await getMyAcademy(deps, mona)).mentor!;
    expect(mentor.rows[0].visits).toEqual({ lastDate: "2026-10-01", open: 2, overdue: 1 });
    expect(mentor.tasks.map((t) => t.key)).not.toContain("club_no_visit");
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

describe("Prax tasks (F6d)", () => {
  const input = {
    clubId: A,
    roles: ["management" as const],
    kompasVersion: 1,
    kompasResult: { filledAreas: 11, areas: [], next: [{ area: 3, points: 6 }] as never },
    kompasUnsent: false,
    licensingClosed: true,
    teamsWithoutCoach: 0,
  };
  const p = {
    area: 3,
    roleId: "v",
    firstStepTitle: "Vyplňte prehľad trénerov",
    tasksTotal: 3,
    stepsTotal: 4,
    next: { label: "1. týždeň", title: "Spočítajte, koho treba" },
  };

  it("asks to finish the first step, then to continue with the next step, only once started", () => {
    expect(clubTasks({ ...input, practice: [{ ...p, tasksDone: 0, stepsDone: 0 }] })).toEqual([
      expect.objectContaining({
        key: "weak_area",
        area: 3,
        practice: { stepsDone: 0, stepsTotal: 4 },
      }),
    ]);
    const first = clubTasks({ ...input, practice: [{ ...p, tasksDone: 1, stepsDone: 0 }] });
    expect(first[0]).toMatchObject({
      key: "practice_first",
      step: "Vyplňte prehľad trénerov",
      href: `/oblasti/3?tab=prax&role=v&club=${encodeURIComponent(A)}`,
    });
    const next = clubTasks({ ...input, practice: [{ ...p, tasksDone: 3, stepsDone: 0 }] });
    expect(next[0]).toMatchObject({
      key: "practice_next",
      step: "1. týždeň: Spočítajte, koho treba",
    });
    const done = clubTasks({
      ...input,
      practice: [{ ...p, tasksDone: 3, stepsDone: 4, next: null }],
    });
    expect(done.map((t) => t.key)).toEqual(["weak_area"]);
  });

  it("builds the input from the Prax content and the role", async () => {
    const store = memoryPracticeStore(memoryContentStore());
    await seedPractice(store, admin, [prax3]);
    const content = (await store.findPractice(3))!.content as never;
    expect(practiceInput(3, content, null, "nope")).toBeNull();
    expect(practiceInput(3, content, { tasks: ["t1"], steps: [] }, "t")).toMatchObject({
      roleId: "t",
      tasksDone: 1,
      tasksTotal: 3,
      stepsDone: 0,
      next: { label: expect.any(String) },
    });
  });
});

describe("splitTasks", () => {
  it("keeps up to three tasks to do and the weak areas apart", () => {
    const tasks = clubTasks({
      clubId: A,
      roles: ["management"],
      kompasVersion: 2,
      kompasResult: {
        filledAreas: 11,
        areas: [],
        next: [
          { area: 8, points: 6 },
          { area: 4, points: 8 },
        ] as never,
      },
      kompasUnsent: true,
      licensingClosed: false,
      teamsWithoutCoach: 1,
    });
    const split = splitTasks(tasks, 2);
    expect(split.todo.map((t) => t.key)).toEqual(["kompas_unsent", "licensing_open"]);
    expect(split.more).toBe(1);
    expect(split.weak.map((t) => t.area)).toEqual([8, 4]);
    expect(split.practice).toEqual([]);
    const withPrax = splitTasks([
      { key: "practice_next", severity: "info", href: "/x", area: 3, step: "s" },
    ]);
    expect(withPrax.practice.map((t) => t.key)).toEqual(["practice_next"]);
    expect(withPrax.todo).toEqual([]);
  });
});

describe("plan tasks (CP-b)", () => {
  it("asks management for a plan once the Kompas is filled, then shows goals near the due date", async () => {
    const deps = await setup();
    const keys = async (u: typeof alice) =>
      (await getMyAcademy(deps, u)).clubs[0].tasks.map((t) => t.key);
    expect(await keys(alice)).not.toContain("plan_missing");
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    expect(await keys(alice)).toContain("plan_missing");
    expect(await keys(bob)).not.toContain("plan_missing");
    await (deps.plans as ReturnType<typeof memoryPlanStore>).savePlan(A, "2026/2027", 0, {
      goals: [
        {
          id: "g1",
          area: 3,
          title: "Náhradník v každej kategórii",
          publicText: "Každý tím má trénera aj zástupcu.",
          indicator: "",
          owner: "Bob",
          ownerId: "bob",
          dueDate: "2026-10-20",
          status: "doing",
          doneAt: null,
        },
      ],
      confirmedAt: null,
      confirmedBy: null,
      editedAt: null,
      updatedAt: new Date(),
      updatedBy: "alice",
    });
    expect(await keys(alice)).not.toContain("plan_missing");
    const bobTask = (await getMyAcademy(deps, bob)).clubs[0].tasks.find(
      (t) => t.key === "plan_goal",
    );
    expect(bobTask).toMatchObject({
      step: "Náhradník v každej kategórii",
      area: 3,
      due: { overdue: false },
    });
    const mentor = (await getMyAcademy(deps, mona)).mentor!;
    expect(mentor.rows[0].plan).toMatchObject({ goals: 1, done: 0 });
    expect(mentor.tasks.map((t) => t.key)).not.toContain("club_no_plan");
  });
});
