import { beforeEach, describe, expect, it } from "vitest";

import { admin, alice } from "./clubs.fixture";
import { memoryContentStore } from "./content.fixture";
import {
  buildContentSeed,
  listAreas,
  listQuestionRevisions,
  listQuestions,
  revertQuestion,
  seedContent,
  updateArea,
  updateQuestion,
} from "./content.service";

const at = new Date("2026-10-16T12:00:00Z");

describe("content seed", () => {
  it("contains 11 areas and 220 questions with stable ids", () => {
    const seed = buildContentSeed(undefined, at);
    expect(seed.areas).toHaveLength(11);
    expect(seed.questions).toHaveLength(220);
    expect(seed.areas[3]).toMatchObject({ number: 4, name: "Dobrovoľníci", band: 1 });
    expect(seed.questions.find((q) => q.questionId === "4.i.2")).toMatchObject({
      area: 4,
      column: "i",
      order: 2,
      text: "Pri každej úlohe je meno; prázdny riadok klub berie ako zadanie, nie ako detail",
      version: 1,
      updatedBy: "seed",
    });
    expect(new Set(seed.questions.map((q) => q.questionId)).size).toBe(220);
    expect(seed.questions.filter((q) => q.tags.includes("rast"))).toHaveLength(7);
  });

  it("rejects a broken seed file", () => {
    expect(() => buildContentSeed({ areas: [] })).toThrow();
  });
});

describe("content service", () => {
  let store: ReturnType<typeof memoryContentStore>;

  beforeEach(async () => {
    store = memoryContentStore();
    await seedContent(store, admin, at);
  });

  it("seeds once and never overwrites edits", async () => {
    await updateQuestion(store, admin, "1.i.1", {
      text: "Upravený text otázky",
      tags: [],
      expectedVersion: 1,
    });
    await expect(seedContent(store, admin, at)).resolves.toEqual({ areas: 0, questions: 0 });
    expect((await store.findQuestion("1.i.1"))?.text).toBe("Upravený text otázky");
    await expect(seedContent(store, alice, at)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets everyone read, also anonymous (ADR 0011)", async () => {
    expect(await listAreas(store, alice)).toHaveLength(11);
    const area3 = await listQuestions(store, alice, 3);
    expect(area3).toHaveLength(20);
    expect(area3.map((q) => q.questionId).slice(0, 2)).toEqual(["3.i.1", "3.i.2"]);
    expect(area3[0]).not.toHaveProperty("updatedBy");
    // public read (ADR 0011)
    expect(await listAreas(store, null)).toHaveLength(11);
    await expect(listQuestions(store, alice, 12)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("edits with version check and keeps history", async () => {
    await expect(
      updateQuestion(store, alice, "3.i.1", { text: "Nový text", tags: [], expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const updated = await updateQuestion(
      store,
      admin,
      "3.i.1",
      { text: "  Nový text otázky  ", tags: ["D", "D", "Z"], expectedVersion: 1 },
      at,
    );
    expect(updated).toMatchObject({ text: "Nový text otázky", tags: ["D", "Z"], version: 2 });

    await expect(
      updateQuestion(store, admin, "3.i.1", { text: "Iný text", tags: [], expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      updateQuestion(store, admin, "3.i.1", { text: "Iný text", tags: ["X"], expectedVersion: 2 }),
    ).rejects.toThrow();
    await expect(
      updateQuestion(store, admin, "9.i.99", { text: "Iný text", tags: [], expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const history = await listQuestionRevisions(store, admin, "3.i.1");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      version: 2,
      after: { text: "Nový text otázky", tags: ["D", "Z"] },
      changedBy: "admin",
    });
  });

  it("does not create a revision when nothing changed", async () => {
    const q = await store.findQuestion("2.s.1");
    await updateQuestion(store, admin, "2.s.1", {
      text: q!.text,
      tags: q!.tags,
      expectedVersion: 1,
    });
    expect(store.revisionDocs).toHaveLength(0);
  });

  it("reverts a change as a new revision", async () => {
    const original = (await store.findQuestion("5.i.1"))!.text;
    await updateQuestion(store, admin, "5.i.1", {
      text: "Zmena na vrátenie",
      tags: [],
      expectedVersion: 1,
    });
    const [rev] = await listQuestionRevisions(store, admin, "5.i.1");
    const reverted = await revertQuestion(store, admin, rev.id, at);
    expect(reverted).toMatchObject({ text: original, version: 3 });
    expect(await listQuestionRevisions(store, admin, "5.i.1")).toHaveLength(2);
    await expect(revertQuestion(store, alice, rev.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(revertQuestion(store, admin, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets admin rename an area with version check and history", async () => {
    const input = {
      name: "Dobrovoľníci",
      shortName: "Dobrovoľníci",
      description: "Rodičia a ďalší ľudia, ktorí klubu pomáhajú.",
      expectedVersion: 1,
    };
    await expect(updateArea(store, alice, 4, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateArea(store, admin, 12, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const renamed = await updateArea(store, admin, 4, { ...input, name: "Dobrovoľníci klubu" }, at);
    expect(renamed).toMatchObject({ number: 4, name: "Dobrovoľníci klubu", version: 2 });
    await expect(updateArea(store, admin, 4, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.revisionDocs.filter((r) => r.entity === "area")).toHaveLength(1);
  });
});
