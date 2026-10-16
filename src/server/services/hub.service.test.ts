import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { A, admin, alice, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore, memoryRoleCatalogStore } from "./content.fixture";
import { seedContent } from "./content.service";
import {
  baseRoleForParam,
  getHub,
  lensForClubRoles,
  orderAreas,
  orderSections,
  mentorPracticeRoles,
  practiceRoleForHubRole,
  seesMentor,
  splitAreas,
  withoutMentor,
  type HubDeps,
} from "./hub.service";
import { roleCatalogSchema } from "./role-catalog.schema";
import { seedRoleCatalog } from "./role-catalog.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8"));
const catalog = roleCatalogSchema.parse(file);

describe("orderAreas", () => {
  it("puts the role's areas first in its order, the rest by number", () => {
    const areas = [1, 2, 3, 4, 5].map((number) => ({ number }));
    expect(orderAreas(areas, [3, 5]).map((a) => [a.number, a.forRole])).toEqual([
      [3, true],
      [5, true],
      [1, false],
      [2, false],
      [4, false],
    ]);
    expect(orderAreas(areas, []).map((a) => a.number)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("splitAreas", () => {
  it("takes three priority areas, the rest of the role as next steps, then the others", () => {
    const areas = orderAreas(
      [1, 2, 3, 4, 5, 6].map((number) => ({ number })),
      [3, 5, 1, 4],
    );
    const split = splitAreas(areas);
    expect(split.priority.map((a) => a.number)).toEqual([3, 5, 1]);
    expect(split.next.map((a) => a.number)).toEqual([4]);
    expect(split.others.map((a) => a.number)).toEqual([2, 6]);
  });

  it("has no priority areas without a role (whole club)", () => {
    const split = splitAreas(
      orderAreas(
        [1, 2].map((number) => ({ number })),
        [],
      ),
    );
    expect(split.priority).toEqual([]);
    expect(split.others).toHaveLength(2);
  });
});

describe("lensForClubRoles", () => {
  it("maps club roles to the Hub lens of the base role", () => {
    const club = catalog.tracks![0];
    expect(lensForClubRoles(club, ["coach"])?.key).toBe("coach");
    expect(lensForClubRoles(club, ["coach", "management"])?.key).toBe("management");
    expect(lensForClubRoles(club, [])).toBeNull();
  });
});

describe("practiceRoleForHubRole", () => {
  it("translates a Hub role to the area's Prax role", () => {
    expect(practiceRoleForHubRole(catalog, 3, "coach")).toBe("t");
    expect(practiceRoleForHubRole(catalog, 4, "parent")).toBe("r");
    expect(practiceRoleForHubRole(catalog, 4, "volunteer")).toBe("h");
    expect(practiceRoleForHubRole(catalog, 3, "mentor")).toBe("m");
    expect(practiceRoleForHubRole(catalog, 3, "whole")).toBeNull();
    expect(practiceRoleForHubRole(catalog, 3, "fan")).toBeNull();
  });
});

describe("Metodika for a role", () => {
  it("resolves the base role from a Hub role, a Prax role or a base role", () => {
    expect(baseRoleForParam(catalog, 3, "coach")).toBe("coach");
    expect(baseRoleForParam(catalog, 4, "h")).toBe("volunteer");
    expect(baseRoleForParam(catalog, 4, "volunteer")).toBe("volunteer");
    expect(baseRoleForParam(catalog, 3, "whole")).toBeNull();
    expect(baseRoleForParam(catalog, 3, "nope")).toBeNull();
    expect(baseRoleForParam(catalog, 3, null)).toBeNull();
  });

  it("puts the intro first, then the role's sections, then the rest", () => {
    const sections = ["popis", "dolezitost", "implementacia", "kategorie", "kniznica"].map(
      (key) => ({ key }),
    );
    const tags = catalog.areas.find((a) => a.area === 3)!.sections;
    expect(orderSections(sections, tags, "coach").map((s) => [s.key, s.forRole])).toEqual([
      ["popis", false],
      ["implementacia", true],
      ["kategorie", true],
      ["kniznica", true],
      ["dolezitost", false],
    ]);
    expect(orderSections(sections, tags, null).map((s) => s.key)).toEqual([
      "popis",
      "dolezitost",
      "implementacia",
      "kategorie",
      "kniznica",
    ]);
  });

  it("tags every Metodika section of the 11 areas", () => {
    for (const a of catalog.areas) {
      expect(Object.keys(a.sections ?? {}).length).toBeGreaterThan(4);
      expect(a.sections?.popis).toEqual(["all"]);
    }
  });
});

describe("mentor behind the scenes", () => {
  it("shows the mentor lens and Prax only to mentors and admin_sfz", () => {
    const season = "2026/2027";
    expect(seesMentor(null, [], season)).toBe(false);
    expect(seesMentor(alice, [{ role: "management", season }], season)).toBe(false);
    expect(seesMentor(alice, [{ role: "mentor", season: "2025/2026" }], season)).toBe(false);
    expect(seesMentor(alice, [{ role: "mentor", season }], season)).toBe(true);
    expect(seesMentor(admin, [], season)).toBe(true);
    const lenses = catalog.tracks![0].hubRoles;
    expect(withoutMentor(lenses, false).some((h) => h.baseRole === "mentor")).toBe(false);
    expect(withoutMentor(lenses, true)).toHaveLength(lenses.length);
    expect(mentorPracticeRoles(catalog, 3)).toEqual(["m"]);
    expect(mentorPracticeRoles(catalog, 1)).toEqual([]);
  });
});

describe("getHub", () => {
  let deps: HubDeps;
  beforeAll(async () => {
    const base = memoryDeps();
    const content = memoryContentStore();
    await seedContent(content, admin);
    const roleCatalog = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(roleCatalog, admin, file);
    deps = { ...base, content, roleCatalog };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
  });

  it("works without sign-in: whole club by default, coach lens reorders areas", async () => {
    const whole = await getHub(deps, null, {});
    expect(whole).toMatchObject({
      track: { key: "club" },
      role: { key: "whole", whole: true },
      club: null,
      defaultsFrom: "none",
    });
    expect(whole!.areas.map((a) => a.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(whole!.areas[3].name).toBe("Dobrovoľníci");
    expect(whole!.roles.map((r) => r.key)).not.toContain("mentor");
    // a mentor lens in the address falls back to the whole club for the public
    expect((await getHub(deps, null, { role: "mentor" }))!.role.key).toBe("whole");

    const coach = await getHub(deps, null, { role: "coach", club: A });
    expect(coach!.areas.slice(0, 2).map((a) => [a.number, a.forRole, Boolean(a.line)])).toEqual([
      [3, true, true],
      [5, true, true],
    ]);
    expect(coach!.role.start?.cta.area).toBe(3);
    expect(coach!.club).toMatchObject({
      clubId: A,
      name: "TJ Test",
      size: "small",
      categories: ["D", "S"],
    });
  });

  it("gives signed-in users the role and club of their membership", async () => {
    const view = await getHub(deps, alice, {});
    expect(view).toMatchObject({
      role: { key: "management" },
      club: { clubId: A },
      defaultsFrom: "membership",
    });
    // an explicit choice in the address wins
    expect((await getHub(deps, alice, { role: "parent" }))!.role.key).toBe("parent");
  });

  it("shows the professional academy track as in preparation, without area details", async () => {
    const ak = await getHub(deps, null, { track: "pro_academy", role: "head_coach", club: A });
    expect(ak).toMatchObject({
      track: { status: "preparing" },
      role: { key: "head_coach" },
      club: null,
    });
    expect(ak!.areas).toHaveLength(11);
    expect(ak!.areas.every((a) => !a.hasDetail)).toBe(true);
    expect(ak!.areas[0].number).toBe(2);
  });
});
