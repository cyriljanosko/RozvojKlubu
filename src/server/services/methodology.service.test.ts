import { beforeEach, describe, expect, it } from "vitest";

import { admin, alice } from "./clubs.fixture";
import { memoryContentStore, memorySectionStore } from "./content.fixture";
import {
  listMethodology,
  listSectionRevisions,
  revertSection,
  seedMethodology,
  updateSection,
} from "./methodology.service";
import type { MethodologyFile } from "./methodology-file";

const files: MethodologyFile[] = [
  {
    area: 8,
    source: null,
    validAsOf: "2026-10-01",
    reviewedAt: null,
    sections: [
      { key: "popis", order: 1, title: "Popis", body: "Text o **financiách**." },
      { key: "dane", order: 2, title: "2 % z dane", body: "Termín 15. 12." },
    ],
  },
];
const at = new Date("2026-10-16T12:00:00Z");

describe("methodology service", () => {
  let store: ReturnType<typeof memorySectionStore>;

  beforeEach(async () => {
    store = memorySectionStore(memoryContentStore());
    expect(await seedMethodology(store, admin, files, at)).toBe(2);
  });

  it("seeds once, admin only", async () => {
    expect(await seedMethodology(store, admin, files, at)).toBe(0);
    await expect(seedMethodology(store, alice, files)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is readable by signed-in users in order", async () => {
    const sections = await listMethodology(store, alice, 8);
    expect(sections.map((s) => s.key)).toEqual(["popis", "dane"]);
    expect(sections[0]).toMatchObject({ validAsOf: "2026-10-01", reviewedAt: null, version: 1 });
    expect(sections[0]).not.toHaveProperty("updatedBy");
    await expect(listMethodology(store, null, 8)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(listMethodology(store, alice, 0)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("edits with version, review dates and history; reverts", async () => {
    await expect(
      updateSection(store, alice, 8, "dane", {
        title: "X",
        body: "Y",
        validAsOf: null,
        reviewedAt: null,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const updated = await updateSection(
      store,
      admin,
      8,
      "dane",
      {
        title: "2 % z dane",
        body: "Termín 15. 12. 2026",
        validAsOf: "2026-10-16",
        reviewedAt: "2026-10-16",
        expectedVersion: 1,
      },
      at,
    );
    expect(updated).toMatchObject({
      body: "Termín 15. 12. 2026",
      version: 2,
      reviewedAt: "2026-10-16",
    });

    await expect(
      updateSection(store, admin, 8, "dane", {
        title: "2 % z dane",
        body: "Iný",
        validAsOf: "",
        reviewedAt: "",
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      updateSection(store, admin, 8, "nie-je", {
        title: "Názov",
        body: "Telo",
        validAsOf: null,
        reviewedAt: null,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateSection(store, admin, 8, "dane", {
        title: "2 % z dane",
        body: "Telo",
        validAsOf: "16. 10. 2026",
        reviewedAt: null,
        expectedVersion: 2,
      }),
    ).rejects.toThrow();

    const [rev] = await listSectionRevisions(store, admin, 8, "dane");
    expect(rev).toMatchObject({ entityId: "8.methodology.dane", version: 2 });
    const reverted = await revertSection(store, admin, rev.id, at);
    expect(reverted).toMatchObject({ body: "Termín 15. 12.", validAsOf: "2026-10-01", version: 3 });
  });

  // Bug 2026-10-16: a <textarea> submits CRLF line endings, so saving only a date
  // rewrote the whole Markdown body and recorded a false text change.
  it("normalizes CRLF from forms and keeps the body unchanged", async () => {
    await seedMethodology(
      store,
      admin,
      [
        {
          area: 9,
          source: null,
          validAsOf: null,
          reviewedAt: null,
          sections: [{ key: "popis", order: 1, title: "Popis", body: "Riadok 1\n\nRiadok 2" }],
        },
      ],
      at,
    );
    const updated = await updateSection(store, admin, 9, "popis", {
      title: "Popis",
      body: "Riadok 1\r\n\r\nRiadok 2",
      validAsOf: "2026-10-16",
      reviewedAt: null,
      expectedVersion: 1,
    });
    expect(updated.body).toBe("Riadok 1\n\nRiadok 2");
    const [rev] = await listSectionRevisions(store, admin, 9, "popis");
    expect(rev.before?.body).toBe(rev.after.body);
  });
});
