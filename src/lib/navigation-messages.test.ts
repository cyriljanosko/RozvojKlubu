import { describe, expect, it } from "vitest";

import sk from "../../messages/sk.json";

import {
  adminMenu,
  breadcrumbs,
  buildNavigation,
  clubMenu,
  menuSections,
  type NavContext,
} from "./navigation";

const contexts: NavContext[] = [
  { signedIn: false, isAdmin: false, clubs: [] },
  { signedIn: true, isAdmin: false, clubs: [] },
  { signedIn: true, isAdmin: false, clubs: [{ clubId: "c1", roles: ["club_manager", "mentor"] }] },
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
    for (const entry of [...clubMenu("c1", ["club_manager"], true), ...adminMenu()]) {
      keys.add(entry.labelKey);
    }
    for (const ctx of contexts) {
      for (const section of menuSections(ctx)) {
        keys.add(section.titleKey);
        for (const entry of section.items) keys.add(entry.labelKey);
      }
    }
    const paths = [
      "/oblasti/1",
      "/klub/c1/kompas/odoslane/s1",
      "/klub/c1/navstevy/nova",
      "/klub/c1/navstevy/v1",
      "/klub/c1/vizitka",
      "/klub/c1/licencne-hodnotenie",
      "/klub/c1/mentoring",
      "/klub/c1/plan",
      "/klub/c1/novinky/n1",
      "/vizitka/c1",
      "/admin/kluby/c1",
      "/admin/obsah/roly",
      "/admin/obsah/1/metodika",
      "/admin/obsah/1/prax",
      "/admin/novinky/n1",
      "/admin/sportnet",
      "/novinky/a",
      "/mentor",
      "/analyza",
      "/ucet",
      "/hladat",
      "/o-akademii",
      "/viac",
      "/prihlasenie",
      "/kompas",
    ];
    for (const path of paths) {
      for (const crumb of breadcrumbs(path, true)) if (crumb.labelKey) keys.add(crumb.labelKey);
    }
    for (const key of keys) expect(nav[key], key).toBeTruthy();
  });
});
