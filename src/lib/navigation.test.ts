import { describe, expect, it } from "vitest";

import { adminMenu, buildNavigation, clubMenu, type NavContext } from "./navigation";

const ids = (items: { id: string }[]) => items.map((entry) => entry.id);
const hrefOf = (items: { id: string; href: string }[], id: string) =>
  items.find((entry) => entry.id === id)?.href;

const signedIn = (partial: Partial<NavContext>): NavContext => ({
  signedIn: true,
  isAdmin: false,
  clubs: [],
  ...partial,
});

describe("buildNavigation – visitor", () => {
  const nav = buildNavigation({ signedIn: false, isAdmin: false, clubs: [] });

  it("shows the public sections and sign-in", () => {
    expect(nav.home).toBe("/");
    expect(ids(nav.main)).toEqual(["academy", "areas", "kompas", "clubs", "about"]);
    expect(ids(nav.tabs)).toEqual(["academy", "areas", "kompas", "clubs", "signIn"]);
  });

  it("offers the Kompas trial, not a club Kompas", () => {
    expect(hrefOf(nav.main, "kompas")).toBe("/kompas");
  });
});

describe("buildNavigation – signed in", () => {
  it("without a club: home, areas, trial Kompas, clubs, more", () => {
    const nav = buildNavigation(signedIn({}));
    expect(nav.home).toBe("/moja-akademia");
    expect(ids(nav.tabs)).toEqual(["home", "clubs", "areas", "kompas", "more"]);
    expect(hrefOf(nav.tabs, "kompas")).toBe("/kompas");
    expect(ids(nav.more)).not.toContain("analytics");
    expect(ids(nav.more)).not.toContain("admin");
  });

  it("club management: my club, club Kompas and analytics", () => {
    const nav = buildNavigation(signedIn({ clubs: [{ clubId: "c1", roles: ["management"] }] }));
    expect(ids(nav.tabs)).toEqual(["home", "myClub", "areas", "kompas", "more"]);
    expect(hrefOf(nav.tabs, "myClub")).toBe("/klub/c1");
    expect(hrefOf(nav.tabs, "kompas")).toBe("/klub/c1/kompas");
    expect(ids(nav.more)).toContain("analytics");
    expect(nav.activeClubId).toBe("c1");
  });

  it("coach: club Kompas, but no analytics in the menu", () => {
    const nav = buildNavigation(signedIn({ clubs: [{ clubId: "c1", roles: ["coach"] }] }));
    expect(hrefOf(nav.tabs, "kompas")).toBe("/klub/c1/kompas");
    expect(ids(nav.more)).not.toContain("analytics");
  });

  it("mentor only: mentor's clubs instead of my club, trial Kompas", () => {
    const nav = buildNavigation(signedIn({ clubs: [{ clubId: "c9", roles: ["mentor"] }] }));
    expect(ids(nav.tabs)).toEqual(["home", "mentorClubs", "areas", "kompas", "more"]);
    expect(hrefOf(nav.tabs, "kompas")).toBe("/kompas");
    expect(ids(nav.more)).toEqual(expect.arrayContaining(["analytics", "mentorWorkspace"]));
    expect(nav.activeClubId).toBeNull();
  });

  it("uses the picked club and falls back to the first own club", () => {
    const clubs = [
      { clubId: "c1", roles: ["coach"] as const },
      { clubId: "c2", roles: ["management"] as const },
    ];
    expect(buildNavigation(signedIn({ clubs, activeClubId: "c2" })).activeClubId).toBe("c2");
    expect(buildNavigation(signedIn({ clubs, activeClubId: "gone" })).activeClubId).toBe("c1");
  });

  it("admin: analytics and administration, at most five tabs", () => {
    const nav = buildNavigation(signedIn({ isAdmin: true }));
    expect(ids(nav.main)).toEqual(["home", "areas", "clubs", "analytics", "admin"]);
    expect(ids(nav.tabs)).toEqual(["home", "areas", "clubs", "analytics", "more"]);
    expect(ids(nav.more)).toEqual(expect.arrayContaining(["admin", "mentorWorkspace"]));
  });

  it("never gives the TabBar more than five items", () => {
    const contexts: NavContext[] = [
      { signedIn: false, isAdmin: false, clubs: [] },
      signedIn({}),
      signedIn({ clubs: [{ clubId: "c1", roles: ["management", "mentor"] }] }),
      signedIn({ isAdmin: true, clubs: [{ clubId: "c1", roles: ["coach"] }] }),
    ];
    for (const ctx of contexts) expect(buildNavigation(ctx).tabs.length).toBeLessThanOrEqual(5);
  });

  it("gives every TabBar item an icon", () => {
    const nav = buildNavigation(signedIn({ clubs: [{ clubId: "c1", roles: ["management"] }] }));
    for (const entry of nav.tabs) expect(entry.icon).toBeTruthy();
  });
});

describe("clubMenu", () => {
  it("is empty for someone without a role in the club", () => {
    expect(clubMenu("c1", [], false)).toEqual([]);
  });

  it("gives management the full sub-menu with an exact overview link", () => {
    const menu = clubMenu("c1", ["management"], false);
    expect(ids(menu)).toEqual([
      "clubOverview",
      "clubKompas",
      "clubPlan",
      "clubLicensing",
      "clubMentoring",
      "clubNews",
    ]);
    expect(menu[0]).toMatchObject({ href: "/klub/c1", match: "exact" });
  });

  it("has no separate visits item – visits live in the mentoring page (29. 10. 2026)", () => {
    expect(ids(clubMenu("c1", ["mentor"], false))).not.toContain("clubVisits");
  });

  it("shows Novinky proposals to management and the mentor, not to coaches (ADR 0023)", () => {
    expect(ids(clubMenu("c1", ["mentor"], false))).toContain("clubNews");
    expect(ids(clubMenu("c1", ["coach"], false))).not.toContain("clubNews");
    expect(ids(clubMenu("c1", [], true))).toContain("clubNews");
  });

  it("hides the club's own Kompas from a mentor (they see only submitted ones)", () => {
    expect(ids(clubMenu("c1", ["mentor"], false))).not.toContain("clubKompas");
    expect(ids(clubMenu("c1", ["mentor"], true))).toContain("clubKompas");
  });
});

describe("adminMenu", () => {
  it("lists the existing admin screens", () => {
    expect(ids(adminMenu())).toEqual(["adminClubs", "adminContent", "adminRoles", "adminNews"]);
  });
});
