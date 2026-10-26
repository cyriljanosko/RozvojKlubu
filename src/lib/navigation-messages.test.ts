import { describe, expect, it } from "vitest";

import sk from "../../messages/sk.json";

import { adminMenu, buildNavigation, clubMenu, type NavContext } from "./navigation";

const contexts: NavContext[] = [
  { signedIn: false, isAdmin: false, clubs: [] },
  { signedIn: true, isAdmin: false, clubs: [] },
  { signedIn: true, isAdmin: false, clubs: [{ clubId: "c1", roles: ["management", "mentor"] }] },
  { signedIn: true, isAdmin: true, clubs: [] },
];

describe("navigation texts", () => {
  it("has a Slovak text for every label of the navigation model", () => {
    const nav = sk.nav as Record<string, string>;
    const keys = new Set<string>();
    for (const ctx of contexts) {
      const model = buildNavigation(ctx);
      for (const entry of [...model.main, ...model.tabs, ...model.more]) keys.add(entry.labelKey);
    }
    for (const entry of [...clubMenu("c1", ["management"], true), ...adminMenu()]) {
      keys.add(entry.labelKey);
    }
    for (const key of keys) expect(nav[key], key).toBeTruthy();
  });
});
