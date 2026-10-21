import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryVisitStore } from "./mentor-visit.fixture";
import {
  buildVisitContent,
  createMentorVisit,
  getMentorVisit,
  listMentorVisits,
  openActions,
  sendMentorVisit,
  setVisitActionDone,
  updateMentorVisit,
  visibleTo,
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
    const first = buildVisitContent(input as never, [], id);
    expect(first).toMatchObject({ season: "2026/2027", findings: [{ area: 3 }] });
    expect(first.actions.map((a) => [a.id, a.done])).toEqual([
      ["a1", false],
      ["a2", false],
    ]);
    const doneAt = new Date("2026-10-20T00:00:00Z");
    const again = buildVisitContent(
      { ...input, actions: [{ ...input.actions[0], id: "a1" }] } as never,
      [{ ...first.actions[0], done: true, doneAt, doneBy: "bob" }],
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
        [],
      ),
    ).toThrow("One finding per area");
    expect(buildVisitContent({ ...input, date: "2027-05-01" } as never, []).season).toBe(
      "2026/2027",
    );
    expect(buildVisitContent({ ...input, date: "2027-07-01" } as never, []).season).toBe(
      "2027/2028",
    );
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
      owner: "x",
      dueDate,
      done,
      doneAt: null,
      doneBy: null,
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
    deps = { ...base, visits: memoryVisitStore() };
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
});
