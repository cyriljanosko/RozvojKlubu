import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryEvaluationStore, memoryLicensingSubmissionStore } from "./licensing.fixture";
import {
  closeLicensing,
  getLicensing,
  listLicensingSubmissions,
  reopenLicensing,
  saveLicensing,
  type LicensingDeps,
} from "./licensing.service";

const mona = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" as const };
const carl = { id: "carl", email: "carl@iny.sk", name: "Carl", role: "public" as const };

const emptyInputs = {
  population: null,
  infrastructure: {},
  activities: {},
  cooperation: {},
  coachGender: {},
};

async function setup(): Promise<LicensingDeps> {
  const base = memoryDeps();
  const people = [admin, alice, bob, mona, carl];
  base.users.findByEmail = async (e) => people.find((p) => p.email === e) ?? null;
  base.users.findById = async (id) => people.find((p) => p.id === id) ?? null;
  // a past season for club A (copy of the current one)
  const current = (await base.clubs.findSeason(A, "2026/2027"))!;
  const past = { ...current, season: "2025/2026" };
  const findSeason = base.clubs.findSeason;
  base.clubs.findSeason = async (id, s) =>
    id === A && s === "2025/2026" ? structuredClone(past) : findSeason(id, s);
  base.clubs.listSeasonNames = async (id) => (id === A ? ["2025/2026", "2026/2027"] : []);
  const deps = {
    ...base,
    evaluations: memoryEvaluationStore(),
    licensingSubmissions: memoryLicensingSubmissionStore(),
  };
  await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
  await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
  await addClubMember(deps, admin, A, { email: "mona@obfz.sk", role: "mentor" });
  return deps;
}

describe("licensing evaluation", () => {
  let deps: LicensingDeps;
  beforeEach(async () => {
    deps = await setup();
  });

  it("computes areas 2–4 from Sportnet for the current season, empty areas 5–7", async () => {
    const view = await getLicensing(deps, alice, A);
    expect(view).toMatchObject({
      season: "2026/2027",
      seasons: ["2026/2027", "2025/2026"],
      access: "edit",
      closed: null,
      version: 0,
      dataAsOf: "2026-10-11",
    });
    // 1 team in a competition × 20; 22 + 9 × 1.5 players; UEFA B = 6
    expect(view.result.areas.map((a) => a.points)).toEqual([20, 35.5, 6, 0, 0, 0]);
    expect(view.result.areas[3].status).toBe("empty");
  });

  it("lets management and the mentor edit, the coach only read, others nothing", async () => {
    expect((await getLicensing(deps, bob, A)).access).toBe("read");
    expect((await getLicensing(deps, mona, A)).access).toBe("edit");
    await expect(getLicensing(deps, carl, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getLicensing(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      saveLicensing(deps, bob, A, { season: "2026/2027", inputs: emptyInputs, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const byMentor = await saveLicensing(deps, mona, A, {
      season: "2026/2027",
      inputs: { ...emptyInputs, population: 1500, infrastructure: { grass_105x68: 1 } },
      expectedVersion: 0,
    });
    expect(byMentor).toMatchObject({ version: 1, inputs: { population: 1500 } });
    expect(byMentor.result.areas[0].points).toBe(30); // 20 × 1.5
    expect(byMentor.result.areas[3]).toMatchObject({ points: 30, band: "grassroots" });
  });

  it("isolates clubs", async () => {
    await expect(getLicensing(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getLicensing(deps, admin, B)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listLicensingSubmissions(deps, alice, B)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("validates inputs, versions and coach names, and stores only non-empty values", async () => {
    const save = (inputs: unknown, expectedVersion = 0, season = "2026/2027") =>
      saveLicensing(deps, alice, A, { season, inputs, expectedVersion });
    await expect(save({ ...emptyInputs, infrastructure: { castle: 1 } })).rejects.toThrow();
    await expect(save({ ...emptyInputs, activities: { website: 3 } })).rejects.toThrow();
    await expect(save({ ...emptyInputs, coachGender: { Nobody: "F" } })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(save(emptyInputs, 0, "2019/2020")).rejects.toMatchObject({ code: "NOT_FOUND" });

    const v1 = await save({
      ...emptyInputs,
      activities: { website: true, facebook: false, youth_tournaments: 0, veterans_40: 2 },
      coachGender: { "Ján Testovací": "F" },
    });
    expect(v1.inputs.activities).toEqual({ website: true, veterans_40: 2 });
    expect(v1.result.areas[2].points).toBe(9); // UEFA B × 1.5
    await expect(save(emptyInputs, 0)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await save(emptyInputs, 1)).version).toBe(2);
  });

  it("closes a season as a frozen copy and locks it; past seasons stay editable until closed", async () => {
    const past = await saveLicensing(deps, alice, A, {
      season: "2025/2026",
      inputs: { ...emptyInputs, population: 80 },
      expectedVersion: 0,
    });
    expect(past.result.coefficient).toBe(1.9);

    await expect(
      closeLicensing(deps, bob, A, { season: "2025/2026", expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      closeLicensing(deps, mona, A, { season: "2025/2026", expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const closed = await closeLicensing(deps, mona, A, { season: "2025/2026", expectedVersion: 1 });
    expect(closed).toMatchObject({ season: "2025/2026", closedBy: "mona", ruleSet: "pilot-2026" });

    await expect(
      saveLicensing(deps, alice, A, {
        season: "2025/2026",
        inputs: emptyInputs,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      closeLicensing(deps, alice, A, { season: "2025/2026", expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const frozen = await getLicensing(deps, bob, A, "2025/2026");
    expect(frozen.closed?.id).toBe(closed.id);
    expect(frozen.result.coefficient).toBe(1.9);
    expect(await listLicensingSubmissions(deps, bob, A)).toHaveLength(1);

    // the current season is still open
    expect((await getLicensing(deps, alice, A)).closed).toBeNull();
  });

  it("lets only admin_sfz reopen a closed season, keeps the history and allows closing again", async () => {
    await saveLicensing(deps, alice, A, {
      season: "2026/2027",
      inputs: { ...emptyInputs, population: 700 },
      expectedVersion: 0,
    });
    const first = await closeLicensing(deps, alice, A, { season: "2026/2027", expectedVersion: 1 });
    expect((await getLicensing(deps, admin, A)).canReopen).toBe(true);
    expect((await getLicensing(deps, alice, A)).canReopen).toBe(false);

    for (const who of [alice, mona, bob]) {
      await expect(reopenLicensing(deps, who, A, { season: "2026/2027" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(reopenLicensing(deps, admin, A, { season: "2025/2026" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const reopened = await reopenLicensing(deps, admin, A, { season: "2026/2027" });
    expect(reopened).toMatchObject({ id: first.id, reopenedAt: expect.any(Date) });

    // open again: editable, working version kept, nothing deleted
    const view = await getLicensing(deps, alice, A);
    expect(view).toMatchObject({ closed: null, version: 1, inputs: { population: 700 } });
    const reset = await saveLicensing(deps, alice, A, {
      season: "2026/2027",
      inputs: emptyInputs,
      expectedVersion: 1,
    });
    expect(reset).toMatchObject({ version: 2, inputs: { population: null } });

    const second = await closeLicensing(deps, mona, A, { season: "2026/2027", expectedVersion: 2 });
    expect(second.id).not.toBe(first.id);
    const history = await listLicensingSubmissions(deps, bob, A);
    expect(history).toHaveLength(2);
    expect(history.filter((h) => h.reopenedAt)).toHaveLength(1);
    expect((await getLicensing(deps, bob, A)).closed?.id).toBe(second.id);
  });
});
