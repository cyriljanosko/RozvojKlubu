import { beforeEach, describe, expect, it } from "vitest";

import { alice, bob } from "./clubs.fixture";
import { memoryPreferencesStore } from "./preferences.fixture";
import {
  MAX_FAVORITES,
  addFavorite,
  getPreferences,
  orderFavorites,
  removeFavorite,
  saveDashboard,
  type PreferencesDeps,
} from "./preferences.service";

describe("preferences", () => {
  let deps: PreferencesDeps & { preferences: ReturnType<typeof memoryPreferencesStore> };
  let seq = 0;
  beforeEach(() => {
    seq = 0;
    deps = { preferences: memoryPreferencesStore(), newId: () => `f${++seq}` };
  });

  it("starts empty, saves the dashboard with a version and keeps users apart", async () => {
    expect(await getPreferences(deps, alice)).toEqual({
      dashboard: { order: [], hidden: [] },
      favorites: [],
      version: 0,
    });
    const saved = await saveDashboard(deps, alice, {
      dashboard: { order: ["tasks", "standing", "tasks"], hidden: ["roles"] },
      expectedVersion: 0,
    });
    expect(saved).toMatchObject({
      dashboard: { order: ["tasks", "standing"], hidden: ["roles"] },
      version: 1,
    });
    await expect(
      saveDashboard(deps, alice, { dashboard: { order: [], hidden: [] }, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getPreferences(deps, bob)).version).toBe(0);
    await expect(
      saveDashboard(deps, alice, {
        dashboard: { order: ["Bad id"], hidden: [] },
        expectedVersion: 1,
      }),
    ).rejects.toThrow();
    await expect(getPreferences(deps, null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("pins internal pages once, unpins by id or path, reorders and keeps the dashboard", async () => {
    await saveDashboard(deps, alice, {
      dashboard: { order: ["tasks"], hidden: [] },
      expectedVersion: 0,
    });
    await addFavorite(deps, alice, { kind: "area", href: "/oblasti/3", label: "Tréneri" });
    await addFavorite(deps, alice, { kind: "vizitka", href: "/klub/x/vizitka", label: "FK X" });
    const again = await addFavorite(deps, alice, {
      kind: "area",
      href: "/oblasti/3",
      label: "Iné",
    });
    expect(again.favorites.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(again.dashboard.order).toEqual(["tasks"]);

    // the dashboard layout saved meanwhile (shared document) must not break the arrows
    await saveDashboard(deps, alice, {
      dashboard: { order: ["favorites"], hidden: [] },
      expectedVersion: again.version,
    });
    const ordered = await orderFavorites(deps, alice, { ids: ["f2", "f1"] });
    expect(ordered.favorites.map((f) => f.label)).toEqual(["FK X", "Tréneri"]);

    expect((await removeFavorite(deps, alice, { href: "/oblasti/3" })).favorites).toHaveLength(1);
    expect((await removeFavorite(deps, alice, { id: "f2" })).favorites).toHaveLength(0);
    await expect(removeFavorite(deps, alice, {})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses external links and more than the maximum", async () => {
    for (const href of ["https://zly.sk", "//zly.sk", "/\\zly.sk", "oblasti/3", "/a b"]) {
      await expect(addFavorite(deps, alice, { kind: "area", href, label: "x" })).rejects.toThrow();
    }
    for (let i = 0; i < MAX_FAVORITES; i++) {
      await addFavorite(deps, alice, { kind: "area", href: `/oblasti/${i}`, label: `${i}` });
    }
    await expect(
      addFavorite(deps, alice, { kind: "area", href: "/oblasti/99", label: "99" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", details: { code: "FAVORITES_FULL" } });
  });

  it("retries a pin when another tab saved meanwhile", async () => {
    await addFavorite(deps, alice, { kind: "area", href: "/oblasti/1", label: "1" });
    const find = deps.preferences.findPreferences;
    let reads = 0;
    deps.preferences.findPreferences = async (id) => {
      const doc = await find(id);
      // the 2nd read is the one the write is based on – another tab saves right after it
      if (++reads === 2 && doc) {
        await deps.preferences.savePreferences(id, doc.version, {
          dashboard: doc.dashboard,
          favorites: doc.favorites,
          updatedAt: new Date(),
        });
      }
      return doc;
    };
    const res = await addFavorite(deps, alice, { kind: "area", href: "/oblasti/2", label: "2" });
    expect(res.favorites.map((f) => f.href)).toEqual(["/oblasti/1", "/oblasti/2"]);
    expect(reads).toBe(3); // pre-check, stale read, retry
    expect(res.version).toBe(3); // first pin, the other tab, our retried write
  });
});
