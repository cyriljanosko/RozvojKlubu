import { describe, expect, it } from "vitest";

import { activeLinkId, isActiveLink, type NavLink } from "./nav-active";

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
