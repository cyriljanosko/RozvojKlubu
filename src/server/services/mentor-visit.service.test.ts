import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memorySubmissionStore } from "./kompas.fixture";
import { memoryVisitStore } from "./mentor-visit.fixture";
import {
  applyRatings,
  assessmentForTopics,
  buildVisitContent,
  createMentorVisit,
  getVisitFormData,
  getMentorVisit,
  listMentorVisits,
  openActions,
  rateMentorVisit,
  setPrepTaskDone,
  summarizeVisits,
  visitTasksFor,
  sendMentorVisit,
  setVisitActionDone,
  updateMentorVisit,
  visibleTo,
  visitViewMode,
  withdrawMentorVisit,
  type MentorVisitDeps,
} from "./mentor-visit.service";
import type { CurrentUser } from "./users.service";

const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };
const input = {
  date: "2026-10-15",
  form: "onsite",
  participants: "Alice (predsedníčka), Bob (tréner U11)",
  summary: "Klub chce do jari doplniť trénera pre U9.",
  findings: [{ area: 3, text: "U9 nemá trénera." }],
  actions: [
    { text: "Osloviť dvoch rodičov na asistenta U9", area: 3, owner: "Bob", dueDate: "2026-11-15" },
    { text: "Vyplniť Kompas", area: null, owner: "Alice", dueDate: null },
  ],
};

describe("mentor visits – pure", () => {
  it("builds the content, derives the season and keeps done state of existing actions", () => {
    let n = 0;
    const id = () => `a${++n}`;
    const first = buildVisitContent(input as never, { actions: [] }, id);
    expect(first).toMatchObject({ season: "2026/2027", findings: [{ area: 3 }] });
    expect(first.actions.map((a) => [a.id, a.done])).toEqual([
      ["a1", false],
      ["a2", false],
    ]);
    const doneAt = new Date("2026-10-20T00:00:00Z");
    const again = buildVisitContent(
      { ...input, actions: [{ ...input.actions[0], id: "a1" }] } as never,
      { actions: [{ ...first.actions[0], done: true, doneAt, doneBy: "bob" }] },
      id,
    );
    expect(again.actions).toEqual([expect.objectContaining({ id: "a1", done: true, doneAt })]);
    expect(() =>
      buildVisitContent(
        {
          ...input,
          findings: [
            { area: 3, text: "x" },
            { area: 3, text: "y" },
          ],
        } as never,
        { actions: [] },
      ),
    ).toThrow("One finding per area");
    expect(
      buildVisitContent({ ...input, date: "2027-05-01" } as never, { actions: [] }).season,
    ).toBe("2026/2027");
    expect(
      buildVisitContent({ ...input, date: "2027-07-01" } as never, { actions: [] }).season,
    ).toBe("2027/2028");
  });

  it("shows only sent visits to the club and lists open actions by due date", () => {
    expect(visibleTo("club", { status: "draft" })).toBe(false);
    expect(visibleTo("club", { status: "withdrawn" })).toBe(false);
    expect(visibleTo("club", { status: "sent" })).toBe(true);
    expect(visibleTo("write", { status: "draft" })).toBe(true);
    const action = (id: string, dueDate: string | null, done = false) => ({
      id,
      text: id,
      area: null,
      ownerId: null,
      owner: "x",
      dueDate,
      done,
      doneAt: null,
      doneBy: null,
      rating: null,
    });
    const open = openActions([
      {
        id: "v1",
        date: "2026-10-01",
        status: "sent",
        actions: [action("late", null), action("soon", "2026-11-01")],
      },
      { id: "v2", date: "2026-10-10", status: "draft", actions: [action("draft", "2026-10-20")] },
      {
        id: "v3",
        date: "2026-10-12",
        status: "sent",
        actions: [action("done", "2026-10-15", true)],
      },
    ]);
    expect(open.map((a) => [a.id, a.visitId])).toEqual([
      ["soon", "v1"],
      ["late", "v1"],
    ]);
  });
});

describe("mentor visits – service", () => {
  let deps: MentorVisitDeps & { visits: ReturnType<typeof memoryVisitStore> };
  beforeEach(async () => {
    const base = memoryDeps();
    deps = { ...base, visits: memoryVisitStore(), submissions: memorySubmissionStore() };
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

  it("mentor records a draft, the club sees it only after sending, then ticks actions", async () => {
    const draft = await createMentorVisit(deps, mona, A, input);
    expect(draft).toMatchObject({ status: "draft", version: 1, createdBy: "mona", clubId: A });
    expect((await listMentorVisits(deps, alice, A)).visits).toEqual([]);
    await expect(getMentorVisit(deps, alice, A, draft.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const edited = await updateMentorVisit(deps, mona, A, draft.id, {
      ...input,
      summary: "Opravené zhrnutie.",
      actions: draft.actions.map(({ id, text, area, owner, dueDate }) => ({
        id,
        text,
        area,
        owner,
        dueDate,
      })),
      expectedVersion: 1,
    });
    expect(edited).toMatchObject({ version: 2, summary: "Opravené zhrnutie." });
    const sent = await sendMentorVisit(deps, mona, A, draft.id, { expectedVersion: 2 });
    expect(sent).toMatchObject({ status: "sent", version: 3 });
    await expect(
      sendMentorVisit(deps, mona, A, draft.id, { expectedVersion: 3 }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const club = await listMentorVisits(deps, bob, A);
    expect(club).toMatchObject({ access: "club", visits: [{ id: draft.id, status: "sent" }] });
    const ticked = await setVisitActionDone(deps, bob, A, draft.id, sent.actions[0].id, {
      done: true,
      expectedVersion: 3,
    });
    expect(ticked.actions[0]).toMatchObject({ done: true, doneBy: "bob" });
    expect(ticked.actions[0].doneAt).toBeInstanceOf(Date);
    await expect(
      setVisitActionDone(deps, bob, A, draft.id, "nope", { done: true, expectedVersion: 4 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("plans a visit with topics and a task before it; the club prepares, the mentor rates (MC)", async () => {
    const planned = await createMentorVisit(deps, mona, A, {
      date: "2026-11-05",
      form: "onsite",
      planned: true,
      topics: [3, 3, 1],
      prepTask: { text: "Spočítať trénerov po kategóriách", dueDate: "2026-11-01" },
      findings: [],
      actions: [],
    });
    expect(planned).toMatchObject({
      status: "planned",
      topics: [1, 3],
      assessment: null,
      prepTask: { done: false, rating: null },
    });
    // the club sees a planned visit and ticks the task before it
    expect((await listMentorVisits(deps, bob, A)).visits.map((v) => v.status)).toEqual(["planned"]);
    const prepared = await setPrepTaskDone(deps, alice, A, planned.id, {
      done: true,
      expectedVersion: 1,
    });
    expect(prepared.prepTask).toMatchObject({ done: true, doneBy: "alice" });

    // the mentor assesses the meeting per topic plus overall; the club's tick survives edits
    const assessment = {
      topics: [
        {
          area: 3,
          strengths: "Vedenie má prehľad.",
          weaknesses: "U9 bez trénera.",
          recommendations: "Osloviť rodičov.",
        },
      ],
      overall: "Dobrý začiatok.",
    };
    const filled = await updateMentorVisit(deps, mona, A, planned.id, {
      date: "2026-11-05",
      form: "onsite",
      topics: [3],
      assessment,
      prepTask: { text: "Spočítať trénerov po kategóriách", dueDate: "2026-11-01" },
      findings: [],
      actions: [{ text: "Osloviť dvoch rodičov", area: 3, owner: "Bob", dueDate: null }],
      expectedVersion: 2,
    });
    expect(filled).toMatchObject({ assessment, summary: "", prepTask: { done: true } });
    const sent = await sendMentorVisit(deps, mona, A, planned.id, { expectedVersion: 3 });
    expect(sent.status).toBe("sent");

    const rated = await rateMentorVisit(deps, mona, A, planned.id, {
      prep: "done",
      actions: [{ id: sent.actions[0].id, rating: "partial" }],
      expectedVersion: 4,
    });
    expect(rated.prepTask?.rating).toBe("done");
    expect(rated.actions[0].rating).toBe("partial");
    // the club cannot rate
    await expect(
      rateMentorVisit(deps, alice, A, planned.id, { prep: "not", expectedVersion: 5 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // a visit without a task before it has nothing to tick
    const plain = await createMentorVisit(deps, mona, A, input);
    await sendMentorVisit(deps, mona, A, plain.id, { expectedVersion: 1 });
    await expect(
      setPrepTaskDone(deps, alice, A, plain.id, { done: true, expectedVersion: 2 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps one assessment block per topic in the topics' order, or one general block (pure)", () => {
    const block = (area: number | null, text = "x") => ({
      area,
      strengths: text,
      weaknesses: "",
      recommendations: "",
    });
    expect(
      assessmentForTopics({ topics: [block(5), block(3), block(9, "")], overall: "o" }, [3, 5, 9]),
    ).toEqual({ topics: [block(3), block(5)], overall: "o" }); // ordered, empty block dropped
    expect(assessmentForTopics({ topics: [block(null)], overall: "" }, [])).toEqual({
      topics: [block(null)],
      overall: "",
    });
    expect(assessmentForTopics({ topics: [block(null, "")], overall: " " }, [])).toBeNull();
    // a block of an area that is not a topic, a general block next to topics, duplicates
    expect(() => assessmentForTopics({ topics: [block(4)], overall: "" }, [3])).toThrow();
    expect(() => assessmentForTopics({ topics: [block(null)], overall: "" }, [3])).toThrow();
    expect(() => assessmentForTopics({ topics: [block(3), block(3)], overall: "" }, [3])).toThrow();
  });

  it("rates only existing steps and the task before the visit (pure)", () => {
    const visit = {
      prepTask: null,
      actions: [
        {
          id: "a1",
          text: "x",
          area: null,
          owner: "x",
          ownerId: null,
          dueDate: null,
          done: true,
          doneAt: null,
          doneBy: null,
          rating: null,
        },
      ],
    };
    expect(applyRatings(visit, { actions: [{ id: "a1", rating: "not" }] }).actions[0].rating).toBe(
      "not",
    );
    expect(() => applyRatings(visit, { actions: [{ id: "zz", rating: "done" }] })).toThrow();
    expect(() => applyRatings(visit, { prep: "done", actions: [] })).toThrow();
    expect(visibleTo("club", { status: "planned" })).toBe(true);
  });

  it("only the club's mentor and admin write; the club cannot edit; other clubs are refused", async () => {
    await expect(createMentorVisit(deps, alice, A, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const v = await createMentorVisit(deps, admin, A, input);
    await expect(
      updateMentorVisit(deps, alice, A, v.id, { ...input, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" }); // a draft does not exist for the club
    await expect(listMentorVisits(deps, mona, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listMentorVisits(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(createMentorVisit(deps, mona, A, { ...input, date: "15. 10." })).rejects.toThrow();
  });

  it("withdraws a visit without deleting it; the club no longer sees it", async () => {
    const v = await createMentorVisit(deps, mona, A, input);
    await sendMentorVisit(deps, mona, A, v.id, { expectedVersion: 1 });
    const withdrawn = await withdrawMentorVisit(deps, mona, A, v.id, { expectedVersion: 2 });
    expect(withdrawn).toMatchObject({ status: "withdrawn", withdrawnBy: "mona" });
    expect(deps.visits.docs).toHaveLength(1);
    expect((await listMentorVisits(deps, alice, A)).visits).toEqual([]);
    expect((await listMentorVisits(deps, mona, A)).visits).toHaveLength(1);
    await expect(
      updateMentorVisit(deps, mona, A, v.id, { ...input, expectedVersion: 3 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("ticks present club members, refuses strangers and prepares the form data", async () => {
    const v = await createMentorVisit(deps, mona, A, {
      ...input,
      participantIds: [alice.id, alice.id],
    });
    expect(v.participantIds).toEqual([alice.id]);
    await expect(
      createMentorVisit(deps, mona, A, { ...input, participantIds: ["stranger"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const empty = await getVisitFormData(deps, mona, A);
    expect(empty.members.map((m) => m.userId).sort()).toEqual(["alice", "bob", "mona"]);
    expect(empty.members.find((m) => m.userId === "alice")?.roles).toEqual(["management"]);
    expect(empty).toMatchObject({ previous: null, weakest: [] });

    await sendMentorVisit(deps, mona, A, v.id, { expectedVersion: 1 });
    await setVisitActionDone(deps, alice, A, v.id, v.actions[1].id, {
      done: true,
      expectedVersion: 2,
    });
    const form = await getVisitFormData(deps, mona, A);
    expect(form.previous).toMatchObject({ id: v.id, done: 1, total: 2 });
    expect(form.previous?.open.map((a) => a.text)).toEqual([input.actions[0].text]);
    await expect(getVisitFormData(deps, alice, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("picks a club member as responsible and refuses strangers", async () => {
    const v = await createMentorVisit(deps, mona, A, {
      ...input,
      actions: [{ ...input.actions[0], owner: "Bob", ownerId: bob.id }],
    });
    expect(v.actions[0]).toMatchObject({ owner: "Bob", ownerId: "bob" });
    await expect(
      createMentorVisit(deps, mona, A, {
        ...input,
        actions: [{ ...input.actions[0], ownerId: "stranger" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("mentor visits – tasks and summary (MV-c)", () => {
  const act = (id: string, ownerId: string | null, dueDate: string | null, done = false) => ({
    id,
    text: id,
    area: null,
    owner: ownerId ?? "Niekto",
    ownerId,
    dueDate,
    done,
    doneAt: null,
    doneBy: null,
    rating: null,
  });
  const visits = [
    {
      id: "v1",
      date: "2026-10-01",
      season: "2026/2027",
      status: "sent" as const,
      actions: [
        act("bob-late", "bob", "2026-10-10"),
        act("alice", "alice", null),
        act("text", null, "2026-12-01"),
      ],
    },
    {
      id: "v2",
      date: "2026-10-15",
      season: "2026/2027",
      status: "draft" as const,
      actions: [act("draft", "bob", null)],
    },
    {
      id: "v0",
      date: "2026-05-01",
      season: "2025/2026",
      status: "sent" as const,
      actions: [act("old-done", "bob", null, true)],
    },
  ];

  it("shows a task to the responsible member and to management, overdue by date", () => {
    const today = "2026-10-21";
    expect(visitTasksFor(visits, { userId: "bob", management: false }, today)).toEqual([
      {
        visitId: "v1",
        actionId: "bob-late",
        text: "bob-late",
        dueDate: "2026-10-10",
        overdue: true,
      },
    ]);
    expect(
      visitTasksFor(visits, { userId: "carol", management: true }, today).map((t) => t.actionId),
    ).toEqual(["bob-late", "text", "alice"]);
    expect(visitTasksFor(visits, { userId: "carol", management: false }, today)).toEqual([]);
  });

  it("summarizes the season: last sent visit, open and overdue actions", () => {
    expect(summarizeVisits(visits, "2026/2027", "2026-10-21")).toEqual({
      lastDate: "2026-10-01",
      open: 3,
      overdue: 1,
      nextPlanned: null,
    });
    expect(summarizeVisits(visits, "2027/2028", "2026-10-21")).toEqual({
      lastDate: null,
      open: 0,
      overdue: 0,
      nextPlanned: null,
    });
    // planned visits: the next one from today on; past planned ones do not count
    const planned = (id: string, date: string) => ({
      id,
      date,
      season: "2026/2027",
      status: "planned" as const,
      actions: [],
    });
    expect(
      summarizeVisits(
        [
          ...visits,
          planned("p1", "2026-10-01"),
          planned("p2", "2026-11-20"),
          planned("p3", "2026-11-05"),
        ],
        "2026/2027",
        "2026-10-21",
      ).nextPlanned,
    ).toBe("2026-11-05");
  });
});

describe("visit detail view mode (bug 21. 10. 2026)", () => {
  it("lets everyone who sees a sent visit tick its actions, the mentor also edits", () => {
    // the responsible person may be the mentor or admin_sfz too – they must be able to tick
    expect(visitViewMode("write", "sent")).toEqual({ checklist: true, form: true });
    expect(visitViewMode("club", "sent")).toEqual({ checklist: true, form: false });
    expect(visitViewMode("write", "draft")).toEqual({ checklist: false, form: true });
    expect(visitViewMode("write", "withdrawn")).toEqual({ checklist: false, form: false });
  });
});
