import { beforeEach, describe, expect, it } from "vitest";

import {
  canWrite,
  getClubMentoring,
  mentoringView,
  saveMentoringPart,
  seesFeedback,
  type MentoringDeps,
} from "./club-mentoring.service";
import { memoryMentoringStore } from "./club-mentoring.fixture";
import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { currentSeason } from "./season";
import type { CurrentUser } from "./users.service";

const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };
const intro = {
  strengths: "Aktívni rodičia.",
  weaknesses: "Málo trénerov.",
  improve: "Tréneri pre U9 a U11.",
  expectations: "Pomoc s náborom.",
};
const closingClub = {
  stepsReview: "Dva kroky splnené.",
  feedback: "Mentor by mohol prísť častejšie.",
  selfAssessment: "Posun v oblasti 3.",
};

describe("club mentoring – pure", () => {
  it("lets management write the club parts and the mentor the mentor parts; admin all", () => {
    expect(canWrite("management", "intro")).toBe(true);
    expect(canWrite("management", "focus")).toBe(false);
    expect(canWrite("mentor", "focus")).toBe(true);
    expect(canWrite("mentor", "closingClub")).toBe(false);
    expect(canWrite("coach", "intro")).toBe(false);
    expect(
      ["intro", "focus", "closingClub", "closingMentor"].every((p) =>
        canWrite("admin", p as never),
      ),
    ).toBe(true);
  });

  it("hides the club's remarks on the mentoring from coaches and allows writing only this season", () => {
    expect(seesFeedback("coach")).toBe(false);
    expect(seesFeedback("mentor")).toBe(true);
    const doc = {
      clubId: A,
      season: "2026/2027",
      intro: null,
      focus: null,
      closingClub: { ...closingClub, savedAt: new Date(), savedBy: "alice" },
      closingMentor: null,
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: "alice",
    };
    const coach = mentoringView(doc, {
      clubId: A,
      season: "2026/2027",
      roles: ["coach"],
      current: true,
    });
    expect(coach.closingClub?.feedback).toBeNull();
    expect(coach.closingClub?.stepsReview).toBe(closingClub.stepsReview);
    expect(coach.writes).toEqual([]);
    const old = mentoringView(doc, {
      clubId: A,
      season: "2025/2026",
      roles: ["admin"],
      current: false,
    });
    expect(old.writes).toEqual([]);
    expect(old.done).toEqual({
      intro: false,
      focus: false,
      closingClub: true,
      closingMentor: false,
    });
  });
});

describe("club mentoring – service", () => {
  let deps: MentoringDeps;
  beforeEach(async () => {
    const base = memoryDeps();
    deps = { ...base, mentoring: memoryMentoringStore() };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    base.memberDocs.push({
      id: "m1",
      userId: mona.id,
      clubId: A,
      role: "mentor",
      season: currentSeason(),
      ageGroups: [],
      createdBy: admin.id,
      createdAt: new Date(),
    });
  });

  it("runs the cycle: club intro, mentor focus, both closings – with versions", async () => {
    expect(await getClubMentoring(deps, alice, A)).toMatchObject({
      version: 0,
      role: "management",
      writes: ["intro", "closingClub"],
      intro: null,
    });
    const v1 = await saveMentoringPart(deps, alice, A, "intro", { ...intro, expectedVersion: 0 });
    expect(v1).toMatchObject({ version: 1, intro: { ...intro, savedBy: "alice" } });
    const v2 = await saveMentoringPart(deps, mona, A, "focus", {
      strengths: "Vedenie",
      weaknesses: "Tréneri",
      recommendations: "Nábor",
      assessment: "Malý ambiciózny klub",
      areas: [3, 1, 3],
      expectedVersion: 1,
    });
    expect(v2.focus?.areas).toEqual([1, 3]);
    expect(v2.intro).toMatchObject(intro); // other parts stay
    await expect(
      saveMentoringPart(deps, alice, A, "closingClub", { ...closingClub, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await saveMentoringPart(deps, alice, A, "closingClub", { ...closingClub, expectedVersion: 2 });
    const end = await saveMentoringPart(deps, mona, A, "closingMentor", {
      assessment: "Posun v trénerskej oblasti.",
      nextPlan: "Oblasť 5 na budúcu sezónu.",
      expectedVersion: 3,
    });
    expect(end.done).toEqual({ intro: true, focus: true, closingClub: true, closingMentor: true });
    expect(end.closingClub?.feedback).toBe(closingClub.feedback); // the mentor reads the remarks
    expect((await getClubMentoring(deps, bob, A)).closingClub?.feedback).toBeNull();
  });

  it("refuses wrong roles, other clubs, bad input and anonymous users", async () => {
    await expect(
      saveMentoringPart(deps, bob, A, "intro", { ...intro, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveMentoringPart(deps, alice, A, "focus", { expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubMentoring(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveMentoringPart(deps, mona, A, "focus", {
        strengths: "",
        weaknesses: "",
        recommendations: "",
        assessment: "",
        areas: [],
        expectedVersion: 0,
      }),
    ).rejects.toThrow();
    await expect(getClubMentoring(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(getClubMentoring(deps, admin, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // a past season is read-only
    expect((await getClubMentoring(deps, admin, A, "2020/2021")).writes).toEqual([]);
  });

  it("a mentor who is also the club's management writes both the club and the mentor parts", async () => {
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "mentor" });
    const view = await getClubMentoring(deps, alice, A);
    expect(view.role).toBe("mentor");
    expect([...view.writes].sort()).toEqual(["closingClub", "closingMentor", "focus", "intro"]);
    const v1 = await saveMentoringPart(deps, alice, A, "intro", { ...intro, expectedVersion: 0 });
    const v2 = await saveMentoringPart(deps, alice, A, "focus", {
      strengths: "Vedenie",
      weaknesses: "Tréneri",
      recommendations: "Nábor",
      assessment: "Malý ambiciózny klub",
      areas: [3],
      expectedVersion: v1.version,
    });
    expect(v2.done).toMatchObject({ intro: true, focus: true });
  });
});
