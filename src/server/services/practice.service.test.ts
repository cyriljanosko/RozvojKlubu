import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { admin, alice } from "./clubs.fixture";
import { memoryContentStore, memoryPracticeStore } from "./content.fixture";
import {
  getPractice,
  listPracticeAreas,
  listPracticeRevisions,
  revertPractice,
  seedPractice,
  updatePractice,
} from "./practice.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/prax/03.json"), "utf8"));
const at = new Date("2026-10-16T12:00:00Z");

describe("practice service", () => {
  let store: ReturnType<typeof memoryPracticeStore>;

  beforeEach(async () => {
    store = memoryPracticeStore(memoryContentStore());
    expect(await seedPractice(store, admin, [file], at)).toBe(1);
  });

  it("seeds once, admin only", async () => {
    expect(await seedPractice(store, admin, [file], at)).toBe(0);
    await expect(seedPractice(store, alice, [file])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is readable by signed-in users; areas without practice return null", async () => {
    expect(await listPracticeAreas(store, alice)).toEqual([3]);
    const p = await getPractice(store, alice, 3);
    expect(p?.content.roles.map((r) => r.id)).toEqual(["v", "t", "n", "nd", "k", "m"]);
    expect(await getPractice(store, alice, 5)).toBeNull();
    // public read (ADR 0011)
    expect((await getPractice(store, null, 3))?.area).toBe(3);
    await expect(getPractice(store, alice, 12)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates edits, checks version, keeps history and reverts", async () => {
    const current = (await getPractice(store, admin, 3))!;
    const content = structuredClone(current.content);
    content.roles[0].pathTitle = "Upravený názov cesty";

    await expect(
      updatePractice(store, alice, 3, {
        content,
        validAsOf: null,
        reviewedAt: null,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const broken = structuredClone(content);
    broken.roles[0].library = ["neexistuje"];
    await expect(
      updatePractice(store, admin, 3, {
        content: broken,
        validAsOf: null,
        reviewedAt: null,
        expectedVersion: 1,
      }),
    ).rejects.toThrow(/Unknown template/);

    const updated = await updatePractice(
      store,
      admin,
      3,
      { content, validAsOf: "2026-10-16", reviewedAt: "", expectedVersion: 1 },
      at,
    );
    expect(updated).toMatchObject({ version: 2, validAsOf: "2026-10-16", reviewedAt: null });
    expect(updated.content.roles[0].pathTitle).toBe("Upravený názov cesty");

    await expect(
      updatePractice(store, admin, 3, {
        content,
        validAsOf: null,
        reviewedAt: null,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const [rev] = await listPracticeRevisions(store, admin, 3);
    expect(rev).toMatchObject({ entityId: "3", version: 2 });
    expect(rev).not.toHaveProperty("before");
    const reverted = await revertPractice(store, admin, rev.id, at);
    expect(reverted.version).toBe(3);
    expect(reverted.content.roles[0].pathTitle).toBe(current.content.roles[0].pathTitle);
  });
});
