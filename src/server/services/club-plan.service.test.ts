import { beforeEach, describe, expect, it } from "vitest";

import { memoryPlanStore } from "./club-plan.fixture";
import {
  buildGoals,
  confirmClubPlan,
  getClubPlan,
  getPublicPlan,
  planTasksFor,
  saveClubPlan,
  setGoalStatus,
  suggestAreas,
  summarizePlan,
  type ClubPlanDeps,
} from "./club-plan.service";
import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import type { CurrentUser } from "./users.service";

const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };
const goal = (patch: object = {}) => ({
  area: 3,
  title: "Každá kategória má trénera aj náhradníka",
  publicText: "Chceme, aby mal každý tím svojho trénera aj zástupcu.",
  indicator: "",
  owner: "Bob",
  ownerId: "bob",
  dueDate: "2026-11-30",
  status: "todo" as const,
  ...patch,
});

describe("club plan – pure", () => {
  it("keeps doneAt while a goal stays done and sets it when it becomes done", () => {
    const earlier = new Date("2026-10-01T00:00:00Z");
    const now = new Date("2026-10-21T00:00:00Z");
    let n = 0;
    const id = () => `g${++n}`;
    const goals = buildGoals(
      [
        { ...goal({ status: "done" }), id: "g0" },
        goal({ status: "done" }),
        goal({ status: "doing" }),
      ],
      [{ ...goal({ status: "done" }), id: "g0", doneAt: earlier }],
      now,
      id,
    );
    expect(goals.map((g) => [g.id, g.doneAt])).toEqual([
      ["g0", earlier],
      ["g1", now],
      ["g2", null],
    ]);
  });

  it("suggests the two weakest areas and lists tasks near the due date", () => {
    expect(suggestAreas({ next: [{ area: 7 }, { area: 1 }, { area: 2 }] as never })).toEqual([
      7, 1,
    ]);
    expect(suggestAreas(null)).toEqual([]);
    const plan = {
      goals: [
        { ...goal({ dueDate: "2026-10-15" }), id: "late", doneAt: null },
        {
          ...goal({ dueDate: "2026-10-30", ownerId: null, owner: "Výbor" }),
          id: "soon",
          doneAt: null,
        },
        { ...goal({ dueDate: "2026-12-31" }), id: "far", doneAt: null },
        { ...goal({ dueDate: "2026-10-01", status: "done" }), id: "done", doneAt: null },
      ],
    };
    const today = "2026-10-21";
    expect(planTasksFor(plan, { userId: "bob", management: false }, today)).toEqual([
      { goalId: "late", area: 3, title: goal().title, dueDate: "2026-10-15", overdue: true },
    ]);
    expect(
      planTasksFor(plan, { userId: "alice", management: true }, today).map((t) => t.goalId),
    ).toEqual(["late", "soon"]);
    expect(summarizePlan({ goals: plan.goals as never, confirmedAt: null })).toEqual({
      goals: 4,
      done: 1,
      doing: 0,
      confirmed: false,
      editedAfterConfirm: false,
    });
  });
});

describe("club plan – service", () => {
  let deps: ClubPlanDeps & { plans: ReturnType<typeof memoryPlanStore> };
  beforeEach(async () => {
    const base = memoryDeps();
    const content = memoryContentStore();
    await seedContent(content, admin);
    deps = {
      ...base,
      plans: memoryPlanStore(),
      submissions: memorySubmissionStore(),
      kompas: { ...base, content, assessments: memoryAssessmentStore() },
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
  });

  it("management writes the plan, the coach reads it and changes only their own goal", async () => {
    const empty = await getClubPlan(deps, alice, A);
    expect(empty).toMatchObject({ access: "edit", plan: null, canConfirm: false });
    const saved = await saveClubPlan(deps, alice, A, {
      goals: [goal(), goal({ area: 4, ownerId: null, owner: "Výbor" })],
      expectedVersion: 0,
    });
    expect(saved.plan).toMatchObject({ version: 1, season: "2026/2027" });
    expect(saved.plan?.goals).toHaveLength(2);

    expect((await getClubPlan(deps, bob, A)).access).toBe("read");
    await expect(
      saveClubPlan(deps, bob, A, { goals: [], expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const [own, other] = saved.plan!.goals;
    const doing = await setGoalStatus(deps, bob, A, own.id, {
      status: "doing",
      expectedVersion: 1,
    });
    expect(doing.plan?.goals[0].status).toBe("doing");
    await expect(
      setGoalStatus(deps, bob, A, other.id, { status: "done", expectedVersion: 2 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveClubPlan(deps, alice, A, { goals: [], expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("the mentor edits and confirms; strangers as owners and other clubs are refused", async () => {
    await saveClubPlan(deps, mona, A, { goals: [goal()], expectedVersion: 0 });
    const confirmed = await confirmClubPlan(deps, mona, A, { confirmed: true, expectedVersion: 1 });
    expect(confirmed.plan).toMatchObject({ confirmedBy: "mona" });
    expect(summarizePlan(confirmed.plan).editedAfterConfirm).toBe(false);
    // a status change is not an edit; a change of the goals is
    const id = confirmed.plan!.goals[0].id;
    const status = await setGoalStatus(deps, alice, A, id, { status: "doing", expectedVersion: 2 });
    expect(summarizePlan(status.plan).editedAfterConfirm).toBe(false);
    deps.now = () => new Date("2026-10-17T12:00:00Z");
    const edited = await saveClubPlan(deps, alice, A, {
      goals: [{ ...goal({ title: "Upravený cieľ", status: "doing" }), id }],
      expectedVersion: 3,
    });
    expect(edited.plan).toMatchObject({ confirmedBy: "mona" });
    expect(summarizePlan(edited.plan).editedAfterConfirm).toBe(true);
    await expect(
      confirmClubPlan(deps, alice, A, { confirmed: false, expectedVersion: 4 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveClubPlan(deps, mona, A, { goals: [goal({ ownerId: "stranger" })], expectedVersion: 4 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(getClubPlan(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubPlan(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      saveClubPlan(deps, mona, A, { goals: Array(11).fill(goal()), expectedVersion: 4 }),
    ).rejects.toThrow();
  });

  it("the public plan shows area, public sentence and status – never names", async () => {
    await saveClubPlan(deps, alice, A, { goals: [goal()], expectedVersion: 0 });
    const pub = await getPublicPlan(deps, A);
    expect(pub).toEqual({
      season: "2026/2027",
      goals: [{ area: 3, publicText: goal().publicText, status: "todo" }],
    });
    expect(JSON.stringify(pub)).not.toContain("Bob");
  });
});
