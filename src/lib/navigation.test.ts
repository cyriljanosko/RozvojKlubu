import { describe, expect, it } from "vitest";

import {
  adminMenu,
  breadcrumbs,
  buildNavigation,
  clubMenu,
  menuSections,
  type NavContext,
} from "./navigation";

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
    const nav = buildNavigation(signedIn({ clubs: [{ clubId: "c1", roles: ["club_manager"] }] }));
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
      { clubId: "c2", roles: ["club_manager"] as const },
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
      signedIn({ clubs: [{ clubId: "c1", roles: ["club_manager", "mentor"] }] }),
      signedIn({ isAdmin: true, clubs: [{ clubId: "c1", roles: ["coach"] }] }),
    ];
    for (const ctx of contexts) expect(buildNavigation(ctx).tabs.length).toBeLessThanOrEqual(5);
  });

  it("gives every TabBar item an icon", () => {
    const nav = buildNavigation(signedIn({ clubs: [{ clubId: "c1", roles: ["club_manager"] }] }));
    for (const entry of nav.tabs) expect(entry.icon).toBeTruthy();
  });
});

describe("clubMenu", () => {
  it("is empty for someone without a role in the club", () => {
    expect(clubMenu("c1", [], false)).toEqual([]);
  });

  it("gives management the full sub-menu with an exact overview link", () => {
    const menu = clubMenu("c1", ["club_manager"], false);
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
  it("lists the existing admin screens in the G5 order", () => {
    expect(ids(adminMenu())).toEqual(["adminClubs", "adminContent", "adminNews", "adminSportnet"]);
  });

  it("keeps Obsah active on its sub-pages (role catalog)", () => {
    expect(adminMenu().find((entry) => entry.id === "adminContent")?.match).toBeUndefined();
  });
});

describe("buildNavigation – Menu tab (ADR 0035)", () => {
  it("labels the last tab Menu; it still leads to /viac without JavaScript", () => {
    const tab = buildNavigation(signedIn({})).tabs.at(-1);
    expect(tab).toMatchObject({ id: "more", labelKey: "menu", href: "/viac", icon: "menu" });
  });
});

describe("menuSections", () => {
  const sectionIds = (ctx: NavContext) => menuSections(ctx).map((section) => section.id);
  const itemsOf = (ctx: NavContext, id: string) =>
    ids(menuSections(ctx).find((section) => section.id === id)?.items ?? []);

  it("visitor: public sections and sign-in, no account or administration", () => {
    const ctx = { signedIn: false, isAdmin: false, clubs: [] };
    expect(sectionIds(ctx)).toEqual(["main", "more"]);
    expect(itemsOf(ctx, "main")).toEqual(["academy", "areas", "kompas", "clubs", "news"]);
    expect(itemsOf(ctx, "more")).toEqual(["about", "signIn"]);
  });

  it("club management: the club section holds the club sub-menu, no trial Kompas", () => {
    const ctx = signedIn({ clubs: [{ clubId: "c1", roles: ["club_manager"] }] });
    expect(sectionIds(ctx)).toEqual(["main", "club", "more"]);
    expect(itemsOf(ctx, "club")).toEqual(ids(clubMenu("c1", ["club_manager"], false)));
    expect(itemsOf(ctx, "main")).not.toContain("kompas");
    expect(itemsOf(ctx, "more")).toEqual(["analytics", "account", "about"]);
  });

  it("mentor only: no club section, their clubs in Ďalšie", () => {
    const ctx = signedIn({ clubs: [{ clubId: "c1", roles: ["mentor"] }] });
    expect(sectionIds(ctx)).toEqual(["main", "more"]);
    expect(itemsOf(ctx, "main")).toContain("kompas");
    expect(itemsOf(ctx, "more")).toEqual(["mentorClubs", "analytics", "account", "about"]);
  });

  it("admin: Správa with the admin screens; nobody else gets it", () => {
    const admin = signedIn({ isAdmin: true });
    expect(sectionIds(admin)).toEqual(["main", "more", "admin"]);
    expect(itemsOf(admin, "admin")).toEqual(ids(adminMenu()));
    const coach = signedIn({ clubs: [{ clubId: "c1", roles: ["coach"] }] });
    expect(sectionIds(coach)).not.toContain("admin");
  });
});

describe("breadcrumbs", () => {
  const trail = (path: string, signedInUser = true, names = {}) =>
    breadcrumbs(path, signedInUser, names).map((c) => [c.labelKey ?? c.label, c.href]);

  it("is empty on the home pages, dev pages and unknown top-level paths", () => {
    expect(breadcrumbs("/", false)).toEqual([]);
    expect(breadcrumbs("/moja-akademia", true)).toEqual([]);
    expect(breadcrumbs("/dev/ukazky", true)).toEqual([]);
    expect(breadcrumbs("/neznama", true)).toEqual([]);
  });

  it("starts at Akadémia for visitors and Domov for signed-in people; the last step is no link", () => {
    expect(trail("/oblasti", false)).toEqual([
      ["academy", "/"],
      ["areas", null],
    ]);
    expect(trail("/oblasti")).toEqual([
      ["home", "/moja-akademia"],
      ["areas", null],
    ]);
  });

  it("names areas and clubs when the names are known, otherwise a generic label", () => {
    const names = { clubs: { "c 1": "MŠK Žilina" }, areas: { 4: "Mládež" } };
    expect(trail("/oblasti/4", true, names)).toEqual([
      ["home", "/moja-akademia"],
      ["areas", "/oblasti"],
      ["Mládež", null],
    ]);
    expect(breadcrumbs("/oblasti/7", true).at(-1)).toMatchObject({
      labelKey: "crumbArea",
      params: { number: "7" },
    });
    expect(trail("/klub/c%201/kompas", true, names)).toEqual([
      ["home", "/moja-akademia"],
      ["MŠK Žilina", "/klub/c%201"],
      ["kompas", null],
    ]);
    expect(trail("/klub/c2")).toEqual([
      ["home", "/moja-akademia"],
      ["crumbClub", null],
    ]);
  });

  it("labels detail pages by their parent and skips segments without a page", () => {
    expect(trail("/klub/c1/kompas/odoslane/s1").map(([key]) => key)).toEqual([
      "home",
      "crumbClub",
      "kompas",
      "crumbSubmission",
    ]);
    expect(trail("/klub/c1/navstevy/nova").map(([key]) => key)).toEqual([
      "home",
      "crumbClub",
      "crumbVisits",
      "crumbNewVisit",
    ]);
    expect(trail("/novinky/clanok-1").map(([key]) => key)).toEqual([
      "home",
      "news",
      "crumbNewsItem",
    ]);
  });

  it("keeps Administrácia as plain text – there is no /admin page", () => {
    expect(trail("/admin/obsah/3/prax")).toEqual([
      ["home", "/moja-akademia"],
      ["admin", null],
      ["adminContent", "/admin/obsah"],
      ["crumbArea", "/admin/obsah/3"],
      ["crumbPractice", null],
    ]);
  });

  it("does not break on a malformed escape in the path", () => {
    expect(trail("/klub/%E0").at(-1)).toEqual(["crumbClub", null]);
  });
});
