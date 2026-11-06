import { describe, expect, it, vi } from "vitest";

import type { SportnetAppspace, SportnetMeAppspaces } from "@/server/integrations/sportnet/me";

import {
  deriveManagedClubs,
  planSportnetLinks,
  syncSportnetClubRoles,
  type ClubRolesSyncDeps,
} from "./club-roles-sync.service";

const today = new Date("2026-11-06T10:00:00Z");

const crm = (app_space: string, role: string, extra: Partial<SportnetAppspace> = {}) => ({
  app_id: "CRM",
  app_space,
  role,
  validTo: null,
  org_profile: { _id: app_space, name: `Klub ${app_space}`, type: "club", sport: "futbal" },
  ...extra,
});

const me = (...appspaces: SportnetAppspace[]): SportnetMeAppspaces => ({
  apps: [{ app_id: "CRM", appspaces }],
});

describe("deriveManagedClubs (ADR 0024)", () => {
  it("makes admin, matrikar and manager in CRM club managers", () => {
    const clubs = deriveManagedClubs(
      me(crm("a", "admin"), crm("b", "matrikar"), crm("c", "manager")),
      today,
    );
    expect(clubs.map((c) => c.clubId)).toEqual(["a", "b", "c"]);
    expect(clubs[1]).toEqual({ clubId: "b", name: "Klub b", validTo: undefined });
  });

  it("ignores other CRM roles and other apps", () => {
    const other = {
      apps: [{ app_id: "sutaze", appspaces: [{ ...crm("x", "admin"), app_id: "sutaze" }] }],
    };
    expect(deriveManagedClubs(me(crm("a", "editor"), crm("b", "")), today)).toEqual([]);
    expect(deriveManagedClubs(other, today)).toEqual([]);
  });

  it("takes only clubs, not unions or schools (ADR 0026)", () => {
    const union = crm("futbalsfz.sk", "admin", {
      org_profile: { _id: "futbalsfz.sk", name: "SFZ", type: "union" },
    });
    const school = crm("zs", "manager", { org_profile: { _id: "zs", type: "zakladna-skola" } });
    expect(deriveManagedClubs(me(union, school, crm("k", "matrikar")), today)).toHaveLength(1);
  });

  it("drops roles that ended before today and keeps today's and open-ended ones", () => {
    const clubs = deriveManagedClubs(
      me(
        crm("old", "admin", { validTo: "2026-11-05T23:00:00Z" }),
        crm("today", "admin", { validTo: "2026-11-06T00:00:00Z" }),
        crm("open", "admin"),
      ),
      today,
    );
    expect(clubs.map((c) => c.clubId)).toEqual(["today", "open"]);
    expect(clubs[0].validTo).toEqual(new Date("2026-11-06T00:00:00Z"));
  });

  it("lists a club once and copes with an empty answer", () => {
    expect(deriveManagedClubs(me(crm("a", "admin"), crm("a", "matrikar")), today)).toHaveLength(1);
    expect(deriveManagedClubs({}, today)).toEqual([]);
  });
});

describe("planSportnetLinks", () => {
  const clubs = [
    { clubId: "a", name: "A" },
    { clubId: "b", name: "B", validTo: new Date("2027-01-01") },
  ];

  it("creates a sportnet link per club for the season", () => {
    const links = planSportnetLinks({
      userId: "u1",
      season: "2026/2027",
      now: today,
      clubs,
      appLinks: [],
    });
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      userId: "u1",
      clubId: "a",
      role: "management",
      season: "2026/2027",
      source: "sportnet",
      sportnetRef: "appspace:CRM",
      createdBy: "sportnet",
      syncedAt: today,
    });
    expect(links[0]).not.toHaveProperty("validTo");
    expect(links[1].validTo).toEqual(new Date("2027-01-01"));
  });

  it("does not duplicate a role the admin already gave in the app", () => {
    const links = planSportnetLinks({
      userId: "u1",
      season: "2026/2027",
      now: today,
      clubs,
      appLinks: [
        { clubId: "a", role: "management", season: "2026/2027" }, // old link without source = app
        { clubId: "b", role: "management", season: "2025/2026", source: "app" },
        { clubId: "b", role: "management", season: "2026/2027", source: "sportnet" },
      ],
    });
    expect(links.map((l) => l.clubId)).toEqual(["b"]);
  });
});

describe("syncSportnetClubRoles", () => {
  const deps = (appspaces: SportnetMeAppspaces): ClubRolesSyncDeps => ({
    fetchAppspaces: vi.fn(async () => appspaces),
    insertMissingClubs: vi.fn(async (c) => c.length),
    listUserLinks: vi.fn(async () => []),
    replaceSportnetLinks: vi.fn(async () => {}),
    now: () => today,
  });

  it("creates missing clubs and replaces the user's sportnet links", async () => {
    const d = deps(me(crm("mfk-nova-bana.futbalnet.sk", "matrikar")));
    const result = await syncSportnetClubRoles(d, "u1", "token");
    expect(d.fetchAppspaces).toHaveBeenCalledWith("token");
    expect(d.insertMissingClubs).toHaveBeenCalledWith([
      expect.objectContaining({ clubId: "mfk-nova-bana.futbalnet.sk", source: "sportnet" }),
    ]);
    expect(d.replaceSportnetLinks).toHaveBeenCalledWith("u1", "2026/2027", [
      expect.objectContaining({ clubId: "mfk-nova-bana.futbalnet.sk", role: "management" }),
    ]);
    expect(result).toEqual({ clubs: 1, createdClubs: 1, links: 1 });
  });

  it("removes old sportnet links when the role is gone", async () => {
    const d = deps(me());
    await syncSportnetClubRoles(d, "u1", "token");
    expect(d.insertMissingClubs).not.toHaveBeenCalled();
    expect(d.replaceSportnetLinks).toHaveBeenCalledWith("u1", "2026/2027", []);
  });
});
