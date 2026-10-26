import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import {
  confirmKompasSubmission,
  getSubmission,
  listClubSubmissions,
  listMentorClubs,
  submitKompas,
  withdrawKompasSubmission,
  type SubmissionDeps,
} from "./kompas-submission.service";
import { getKompas, saveKompasAnswers } from "./kompas.service";

const mona = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" as const };

async function setup(): Promise<SubmissionDeps> {
  const base = memoryDeps();
  const people = [admin, alice, bob, mona];
  base.users.findByEmail = async (e) => people.find((p) => p.email === e) ?? null;
  base.users.findById = async (id) => people.find((p) => p.id === id) ?? null;
  const content = memoryContentStore();
  await seedContent(content, admin);
  const deps = {
    ...base,
    content,
    assessments: memoryAssessmentStore(),
    submissions: memorySubmissionStore(),
  };
  await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
  await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
  await addClubMember(deps, admin, A, { email: "mona@obfz.sk", role: "mentor" });
  return deps;
}

describe("kompas submissions", () => {
  let deps: SubmissionDeps;
  beforeEach(async () => {
    deps = await setup();
  });

  it("management submits a frozen copy with the transfer line", async () => {
    await expect(submitKompas(deps, alice, A, { expectedVersion: 1 })).rejects.toMatchObject({
      code: "CONFLICT",
    }); // nothing saved yet
    await saveKompasAnswers(deps, alice, A, { answers: [], expectedVersion: 0 });
    await expect(submitKompas(deps, alice, A, { expectedVersion: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    }); // empty
    await saveKompasAnswers(deps, alice, A, { answers: ["1.i.1", "1.s.1"], expectedVersion: 1 });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 2 });
    expect(sub).toMatchObject({ clubId: A, season: "2026/2027", total: 2, filledAreas: 1 });
    expect(sub.line).toMatch(/^SFZ-KOMPAS-1\|TJ Test\|ObFZ Test\|VsFZ\|2026\/2027\|malý\|1-1,-/);

    // later edits do not change the frozen copy
    await saveKompasAnswers(deps, alice, A, { answers: [], expectedVersion: 2 });
    const frozen = await getSubmission(deps, alice, A, sub.id);
    expect(frozen.answers).toEqual(["1.i.1", "1.s.1"]);
    expect(frozen.questions).toHaveLength(220);
  });

  it("coach cannot submit; mentor reads submissions but not the draft", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["2.i.1"], expectedVersion: 0 });
    await expect(submitKompas(deps, bob, A, { expectedVersion: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 1 });

    await expect(getKompas(deps, mona, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listClubSubmissions(deps, mona, A)).map((s) => s.id)).toEqual([sub.id]);
    await expect(getSubmission(deps, mona, A, sub.id)).resolves.toMatchObject({ clubId: A });
    expect(await listMentorClubs(deps, mona)).toEqual([
      expect.objectContaining({ clubId: A, latest: expect.objectContaining({ id: sub.id }) }),
    ]);
  });

  it("isolates clubs", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["2.i.1"], expectedVersion: 0 });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 1 });
    await expect(listClubSubmissions(deps, mona, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getSubmission(deps, admin, B, sub.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(listMentorClubs(deps, alice)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listMentorClubs(deps, admin)).map((r) => r.clubId).sort()).toEqual([B, A].sort());
  });

  it("lets only admin_sfz withdraw a submission, keeps it in the history and falls back", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    const first = await submitKompas(deps, alice, A, { expectedVersion: 1 });
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1", "3.i.2"], expectedVersion: 1 });
    const second = await submitKompas(deps, alice, A, { expectedVersion: 2 });

    for (const who of [alice, bob, mona]) {
      await expect(withdrawKompasSubmission(deps, who, A, second.id)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(withdrawKompasSubmission(deps, admin, B, second.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const withdrawn = await withdrawKompasSubmission(deps, admin, A, second.id);
    expect(withdrawn.withdrawnAt).toBeInstanceOf(Date);
    await expect(withdrawKompasSubmission(deps, admin, A, second.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const history = await listClubSubmissions(deps, mona, A);
    expect(history).toHaveLength(2);
    expect(Object.fromEntries(history.map((h) => [h.id, h.withdrawnAt !== null]))).toEqual({
      [first.id]: false,
      [second.id]: true,
    });
    expect((await getSubmission(deps, mona, A, second.id)).status).toBe("withdrawn");
    const [row] = (await listMentorClubs(deps, mona)).filter((r) => r.clubId === A);
    expect(row.latest?.id).toBe(first.id);
  });

  it("the club's mentor or admin_sfz confirms a submission and can take it back (ADR 0015)", async () => {
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    const sub = await submitKompas(deps, alice, A, { expectedVersion: 1 });
    expect(sub.confirmedAt).toBeNull();

    for (const who of [alice, bob]) {
      await expect(confirmKompasSubmission(deps, who, A, sub.id, true)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    const confirmed = await confirmKompasSubmission(deps, mona, A, sub.id, true);
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);
    expect((await getSubmission(deps, alice, A, sub.id)).confirmedBy).toBe("mona");
    expect((await listClubSubmissions(deps, alice, A))[0].confirmedAt).toBeInstanceOf(Date);

    expect((await confirmKompasSubmission(deps, admin, A, sub.id, false)).confirmedAt).toBeNull();
    await expect(confirmKompasSubmission(deps, admin, B, sub.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // a new submission starts unconfirmed; a withdrawn one cannot be confirmed
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1", "3.i.2"], expectedVersion: 1 });
    const next = await submitKompas(deps, alice, A, { expectedVersion: 2 });
    expect(next.confirmedAt).toBeNull();
    await withdrawKompasSubmission(deps, admin, A, next.id);
    await expect(confirmKompasSubmission(deps, mona, A, next.id, true)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
