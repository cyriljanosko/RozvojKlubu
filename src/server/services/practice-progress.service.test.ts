import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore, memoryPracticeStore } from "./content.fixture";
import { memoryProgressStore } from "./practice-progress.fixture";
import {
  buildProgress,
  getPracticeProgress,
  savePracticeProgress,
  summarizeProgress,
  type PracticeProgressDeps,
} from "./practice-progress.service";
import { getPractice, seedPractice } from "./practice.service";
import type { CurrentUser } from "./users.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/prax/03.json"), "utf8"));
const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };
const season = "2026/2027";

describe("practice progress – pure", () => {
  let content: Awaited<ReturnType<typeof getPractice>>;
  beforeEach(async () => {
    const store = memoryPracticeStore(memoryContentStore());
    await seedPractice(store, admin, [file]);
    content = await getPractice(store, null, 3);
  });

  it("summarizes tasks and steps per role with the next step", () => {
    const roles = summarizeProgress(content!.content, {
      tasks: ["v1", "v2", "t1"],
      steps: [
        { stepId: "vs1", option: 0, done: true, doneAt: new Date() },
        { stepId: "vs2", option: 1, done: false, doneAt: null },
      ],
    });
    expect(roles.find((r) => r.roleId === "v")).toEqual({
      roleId: "v",
      tasksDone: 2,
      tasksTotal: 3,
      stepsDone: 1,
      stepsTotal: 4,
      nextStepId: "vs2",
    });
    expect(roles.find((r) => r.roleId === "k")).toMatchObject({ tasksDone: 0, nextStepId: "ks1" });
  });

  it("validates ids, keeps doneAt of steps that stay done and drops empty steps", () => {
    const earlier = new Date("2026-10-01T00:00:00Z");
    const now = new Date("2026-10-17T00:00:00Z");
    const next = buildProgress(
      content!.content,
      {
        tasks: ["v2", "v1", "v1"],
        steps: [
          { stepId: "vs1", option: 0, done: true },
          { stepId: "vs2", option: 2, done: true },
          { stepId: "vs3", option: null, done: false },
        ],
        expectedVersion: 1,
      },
      { steps: [{ stepId: "vs1", option: 0, done: true, doneAt: earlier }] },
      now,
    );
    expect(next.tasks).toEqual(["v1", "v2"]);
    expect(next.steps).toEqual([
      { stepId: "vs1", option: 0, done: true, doneAt: earlier },
      { stepId: "vs2", option: 2, done: true, doneAt: now },
    ]);
    const bad = (input: object) => () =>
      buildProgress(
        content!.content,
        { tasks: [], steps: [], expectedVersion: 0, ...input },
        null,
        now,
      );
    expect(bad({ tasks: ["x9"] })).toThrow("Unknown task");
    expect(bad({ steps: [{ stepId: "zz", option: null, done: true }] })).toThrow("Unknown step");
    expect(bad({ steps: [{ stepId: "vs1", option: 3, done: false }] })).toThrow("Unknown option");
  });
});

describe("practice progress – service", () => {
  let deps: PracticeProgressDeps & { progress: ReturnType<typeof memoryProgressStore> };

  beforeEach(async () => {
    const base = memoryDeps();
    const practice = memoryPracticeStore(memoryContentStore());
    await seedPractice(practice, admin, [file]);
    deps = { ...base, practice, progress: memoryProgressStore() };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    base.memberDocs.push({
      id: "m1",
      userId: mona.id,
      clubId: A,
      role: "mentor",
      season,
      ageGroups: [],
      createdBy: admin.id,
      createdAt: new Date(),
    });
  });

  it("management and coach share one record per club, area and season", async () => {
    const saved = await savePracticeProgress(deps, alice, A, 3, {
      tasks: ["v1"],
      steps: [{ stepId: "vs1", option: 1, done: true }],
      expectedVersion: 0,
    });
    expect(saved).toMatchObject({ version: 1, access: "edit", season, tasks: ["v1"] });
    const coach = await savePracticeProgress(deps, bob, A, 3, {
      tasks: ["v1", "t1"],
      steps: saved.steps.map(({ stepId, option, done }) => ({ stepId, option, done })),
      expectedVersion: 1,
    });
    expect(coach.version).toBe(2);
    expect(coach.roles.find((r) => r.roleId === "t")?.tasksDone).toBe(1);
    expect(deps.progress.docs).toHaveLength(1);
    expect(deps.progress.docs[0]).toMatchObject({ clubId: A, area: 3, updatedBy: "bob" });
  });

  it("rejects a stale version (409) and an area without practice (404)", async () => {
    await savePracticeProgress(deps, alice, A, 3, { tasks: [], steps: [], expectedVersion: 0 });
    await expect(
      savePracticeProgress(deps, alice, A, 3, { tasks: [], steps: [], expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(getPracticeProgress(deps, alice, A, 5)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("mentor reads but cannot save; other clubs and anonymous are refused", async () => {
    expect((await getPracticeProgress(deps, mona, A, 3)).access).toBe("read");
    await expect(
      savePracticeProgress(deps, mona, A, 3, { tasks: [], steps: [], expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getPracticeProgress(deps, alice, B, 3)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getPracticeProgress(deps, null, A, 3)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect((await getPracticeProgress(deps, admin, B, 3)).access).toBe("edit");
  });
});
