import { describe, expect, it } from "vitest";

import { A, admin, alice, memoryDeps } from "./clubs.fixture";
import { addClubMember, listPublicClubs } from "./clubs.service";
import { memoryContentStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore } from "./kompas.fixture";
import { getKompasTemplate, saveKompasAnswers } from "./kompas.service";

describe("public trial Kompas (ADR 0011)", () => {
  it("lists clubs and gives questions with validity from the club's categories, never its answers", async () => {
    const content = memoryContentStore();
    await seedContent(content, admin);
    const deps = { ...memoryDeps(), content, assessments: memoryAssessmentStore() };
    expect((await listPublicClubs(deps)).map((c) => c.clubId)).toContain(A);

    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await saveKompasAnswers(deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });

    const t = await getKompasTemplate(deps, A);
    expect(t.club).toMatchObject({ clubId: A, name: "TJ Test" });
    // fixture club: adults + U11 team, women U15 players → categories from teams only
    expect(t.categories).toEqual(["D", "S"]);
    expect(t.questions).toHaveLength(220);
    expect(t.questions.every((q) => !q.checked)).toBe(true);
    expect(t.questions.some((q) => !q.valid)).toBe(true);
    await expect(getKompasTemplate(deps, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
