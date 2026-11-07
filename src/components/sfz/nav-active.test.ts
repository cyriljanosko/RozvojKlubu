import { describe, expect, it } from "vitest";

import { activeLinkId, activeTabId, isActiveLink, type NavLink } from "./nav-active";

describe("isActiveLink", () => {
  it("matches the home link only on /", () => {
    expect(isActiveLink("/", { href: "/" })).toBe(true);
    expect(isActiveLink("/oblasti", { href: "/" })).toBe(false);
  });

  it("matches sub-pages by prefix, but not look-alike paths", () => {
    expect(isActiveLink("/oblasti/3", { href: "/oblasti" })).toBe(true);
    expect(isActiveLink("/oblasti", { href: "/oblasti/" })).toBe(true);
    expect(isActiveLink("/oblastix", { href: "/oblasti" })).toBe(false);
  });

  it("respects exact matching and ignores the query string", () => {
    expect(isActiveLink("/klub/1/plan", { href: "/klub/1", match: "exact" })).toBe(false);
    expect(isActiveLink("/klub/1", { href: "/klub/1?season=2026-2027", match: "exact" })).toBe(
      true,
    );
  });
});

describe("activeLinkId", () => {
  const links: NavLink[] = [
    { id: "overview", label: "Prehľad", href: "/klub/1" },
    { id: "kompas", label: "Kompas", href: "/klub/1/kompas" },
  ];

  it("prefers the most specific link", () => {
    expect(activeLinkId("/klub/1/kompas/odoslane/x", links)).toBe("kompas");
    expect(activeLinkId("/klub/1", links)).toBe("overview");
  });

  it("returns null when nothing matches", () => {
    expect(activeLinkId("/ucet", links)).toBeNull();
  });
});

describe("activeTabId", () => {
  const tabs: NavLink[] = [
    { id: "home", label: "Domov", href: "/" },
    { id: "areas", label: "Oblasti", href: "/oblasti" },
    { id: "more", label: "Viac", href: "/viac" },
  ];
  const more: NavLink[] = [{ id: "admin", label: "Administrácia", href: "/admin/kluby" }];

  it("marks Viac on a page reached from its menu (G5: administration)", () => {
    expect(activeTabId("/admin/sportnet", tabs, more)).toBe("more");
    expect(activeTabId("/admin/kluby/x", tabs, more)).toBe("more");
  });

  it("keeps a direct tab match and marks nothing elsewhere", () => {
    expect(activeTabId("/oblasti/3", tabs, more)).toBe("areas");
    expect(activeTabId("/ucet", tabs, more)).toBeNull();
  });
});
