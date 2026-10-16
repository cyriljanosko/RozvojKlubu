import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { A, admin, alice, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore, memoryRoleCatalogStore } from "./content.fixture";
import { seedContent } from "./content.service";
import {
  getHub,
  lensForClubRoles,
  orderAreas,
  practiceRoleForHubRole,
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
