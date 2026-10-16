import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore } from "./kompas.fixture";
import { getKompas, saveKompasAnswers, type KompasDeps } from "./kompas.service";

const carol = { id: "carol", email: "carol@klub.sk", name: "Carol", role: "public" as const };

async function setup(): Promise<KompasDeps & { store: ReturnType<typeof memoryAssessmentStore> }> {
  const base = memoryDeps();
  const content = memoryContentStore();
  await seedContent(content, admin);
  const store = memoryAssessmentStore();
  const deps = { ...base, content, assessments: store, store };
  await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
  await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
  return deps;
}

describe("kompas service", () => {
  let deps: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    deps = await setup();
  });

  it("derives categories from Sportnet teams and marks question validity", async () => {
    const view = await getKompas(deps, alice, A);
    // sample club: adults + U11 team → S, D (U11 has no competition but is a team)
    expect(view.categories).toEqual(["D", "S"]);
    expect(view).toMatchObject({ access: "edit", version: 0, season: "2026/2027" });
    expect(view.questions).toHaveLength(220);
    expect(view.result.filledAreas).toBe(0);
  });

  it("management saves answers with version check; result follows", async () => {
    const answers = Array.from({ length: 10 }, (_, i) => `1.i.${i + 1}`).concat(
      Array.from({ length: 10 }, (_, i) => `1.s.${i + 1}`),
    );
    const saved = await saveKompasAnswers(deps, alice, A, { answers, expectedVersion: 0 });
    expect(saved.version).toBe(1);
    expect(saved.result.areas[0]).toMatchObject({ area: 1, points: 20 });
    await expect(
      saveKompasAnswers(deps, alice, A, { answers: [], expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const again = await saveKompasAnswers(deps, alice, A, {
      answers: ["1.i.1"],
      expectedVersion: 1,
    });
    expect(again.version).toBe(2);
    expect(deps.store.docs[0]).toMatchObject({ clubId: A, answers: ["1.i.1"], updatedBy: "alice" });
  });

  it("coach reads only, mentor and others are refused, tenants are isolated", async () => {
    await expect(getKompas(deps, bob, A)).resolves.toMatchObject({ access: "read" });
    await expect(
      saveKompasAnswers(deps, bob, A, { answers: [], expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await addClubMember(deps, admin, A, { email: "admin@sfz.sk", role: "mentor" });
    deps.users.findByEmail = async (e) => (e === "carol@klub.sk" ? carol : null);
    await addClubMember(deps, admin, A, { email: "carol@klub.sk", role: "mentor" });
    await expect(getKompas(deps, carol, A)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(getKompas(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getKompas(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(getKompas(deps, admin, B)).resolves.toMatchObject({ access: "edit" });
  });

  it("rejects unknown questions and malformed input", async () => {
    await expect(
      saveKompasAnswers(deps, alice, A, { answers: ["12.i.1"], expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveKompasAnswers(deps, alice, A, { answers: ["x"], expectedVersion: 0 }),
    ).rejects.toThrow();
  });
});
