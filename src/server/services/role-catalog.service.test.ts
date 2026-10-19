import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { admin, alice } from "./clubs.fixture";
import { memoryContentStore, memoryRoleCatalogStore } from "./content.fixture";
import { roleCatalogSchema, type RoleCatalog } from "./role-catalog.schema";
import {
  getRoleCatalog,
  listRoleCatalogRevisions,
  revertRoleCatalog,
  seedRoleCatalog,
  updateRoleCatalog,
} from "./role-catalog.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8"));
const at = new Date("2026-10-16T12:00:00Z");

describe("role catalog file", () => {
  it("contains 7 base roles (ADR 0011), 60 roles in 11 areas and two Hub tracks", () => {
    const c = roleCatalogSchema.parse(file);
    expect(c.baseRoles.map((b) => b.key)).toEqual([
      "management",
      "coach",
      "parent",
      "volunteer",
      "player",
      "mentor",
      "fan",
    ]);
    expect(c.baseRoles.find((b) => b.key === "volunteer")?.name).toBe("Dobrovoľník");
    expect(c.baseRoles.find((b) => b.key === "fan")).toMatchObject({ publicOnly: true });
    expect(c.tracks?.map((t) => [t.key, t.status, t.hubRoles.length])).toEqual([
      ["club", "approved", 8],
      ["pro_academy", "preparing", 7],
    ]);
    const club = c.tracks![0];
    expect(club.hubRoles.map((h) => h.key)).toEqual([
      "whole",
      "coach",
      "management",
      "mentor",
      "parent",
      "volunteer",
      "player",
      "fan",
    ]);
    // the player lens and the management start box are proposals by Claude
    expect(club.hubRoles.filter((h) => h.draft).map((h) => h.key)).toEqual([
      "management",
      "player",
    ]);
    expect(Object.keys(club.teasers ?? {})).toHaveLength(11);
    expect(c.tracks![1].areas).toHaveLength(11);
    expect(c.baseRoles.find((b) => b.key === "management")).toMatchObject({
      name: "Manažér a výbor",
      clubRole: "management",
    });
    expect(c.areas).toHaveLength(11);
    expect(c.areas.reduce((n, a) => n + a.roles.length, 0)).toBe(60);
    expect(c.areas.filter((a) => a.status === "approved").map((a) => a.area)).toEqual([3, 4]);
    // areas 3 and 4 point to the roles of their Prax
    const practice = (n: number) =>
      c.areas
        .find((a) => a.area === n)!
        .roles.map((r) => r.practiceRole)
        .filter(Boolean);
    expect(practice(3)).toEqual(["v", "t", "n", "k", "m"]);
    expect(practice(4)).toEqual(["v", "t", "r", "h", "m"]);
  });

  it("points only to roles that exist in the area's Prax", () => {
    const c = roleCatalogSchema.parse(file);
    for (const n of [3, 4]) {
      const prax = JSON.parse(
        readFileSync(join(process.cwd(), `content/prax/0${n}.json`), "utf8"),
      ) as { roles: { id: string }[] };
      const keys = c.areas.find((a) => a.area === n)!.roles.flatMap((r) => r.practiceRole ?? []);
      expect(keys.every((k) => prax.roles.some((r) => r.id === k))).toBe(true);
    }
  });

  it("accepts a catalog without tracks (before v2)", () => {
    const v1 = structuredClone(file) as RoleCatalog;
    delete v1.tracks;
    expect(roleCatalogSchema.safeParse(v1).success).toBe(true);
  });

  it("rejects unknown base roles and duplicates", () => {
    const broken = structuredClone(file) as RoleCatalog;
    broken.areas[0].roles[0].baseRoles = ["chairman"];
    broken.areas[1].roles[1].key = broken.areas[1].roles[0].key;
    const result = roleCatalogSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        "Unknown base role chairman",
        expect.stringContaining("Duplicate role"),
      ]),
    );
  });
});

describe("role catalog service", () => {
  let store: ReturnType<typeof memoryRoleCatalogStore>;
  beforeEach(async () => {
    store = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(store, admin, file, at);
  });

  it("seeds once, admin only; everyone reads", async () => {
    await expect(seedRoleCatalog(store, admin, file, at)).resolves.toBe(0);
    await expect(seedRoleCatalog(store, alice, file, at)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await getRoleCatalog(store, alice))?.version).toBe(1);
    // public read (ADR 0011)
    expect((await getRoleCatalog(store, null))?.version).toBe(1);
  });

  it("edits with version check, keeps history and reverts", async () => {
    const content = structuredClone(file) as RoleCatalog;
    content.areas[6].status = "approved";
    await expect(
      updateRoleCatalog(store, alice, { content, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const v2 = await updateRoleCatalog(store, admin, { content, expectedVersion: 1 }, at);
    expect(v2.version).toBe(2);
    expect(v2.content.areas[6].status).toBe("approved");
    await expect(
      updateRoleCatalog(store, admin, { content, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // unchanged content does not create a version
    expect((await updateRoleCatalog(store, admin, { content, expectedVersion: 2 })).version).toBe(
      2,
    );

    const [rev] = await listRoleCatalogRevisions(store, admin);
    expect(rev).toMatchObject({ version: 2, changedBy: "admin" });
    const v3 = await revertRoleCatalog(store, admin, rev.id, at);
    expect(v3).toMatchObject({ version: 3 });
    expect(v3.content.areas[6].status).toBe("proposal");
    await expect(listRoleCatalogRevisions(store, alice)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
