import { describe, expect, it, vi } from "vitest";

import { memoryAudit } from "./audit.fixture";

import type {
  SportnetAffiliation,
  SportnetAppspace,
  SportnetMeAppspaces,
} from "@/server/integrations/sportnet/me";

import {
  deriveAffiliationRoles,
  deriveManagedClubs,
  isAffiliationActive,
  normalizeCompetence,
  planSportnetLinks,
  sportnetRoleChanges,
  strongestPerClub,
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

const aff = (
  id: string,
  club: string,
  competence: string,
  extra: Partial<SportnetAffiliation> = {},
): SportnetAffiliation => ({
  _id: id,
  org_profile_id: club,
  competence_type: competence,
  isActive: true,
  ...extra,
});

describe("normalizeCompetence", () => {
  it("drops case, diacritics and extra spaces", () => {
    expect(normalizeCompetence("  Vedúci  družstva / Tímový manažér ")).toBe(
      "veduci druzstva / timovy manazer",
    );
    expect(normalizeCompetence(undefined)).toBe("");
  });
});

describe("isAffiliationActive (B5)", () => {
  it("trusts isActive from /me/*", () => {
    expect(isAffiliationActive({ isActive: false, date_to: null }, today)).toBe(false);
    expect(isAffiliationActive({ isActive: true, date_to: "2020-01-01" }, today)).toBe(true);
  });

  it("falls back to date_from / date_to", () => {
    expect(isAffiliationActive({ date_from: "2020-01-01", date_to: null }, today)).toBe(true);
    expect(isAffiliationActive({ date_from: "2026-11-06", date_to: "2026-11-06" }, today)).toBe(
      true,
    );
    expect(isAffiliationActive({ date_from: "2026-12-01" }, today)).toBe(false);
    expect(isAffiliationActive({ date_to: "2026-11-05" }, today)).toBe(false);
  });
});

describe("deriveAffiliationRoles (ADR 0021)", () => {
  const known = new Set(["a", "b"]);
  const derive = (sportOrgs: SportnetAffiliation[], sportExpertOrgs: SportnetAffiliation[]) =>
    deriveAffiliationRoles({ sportOrgs, sportExpertOrgs }, today, known);

  it("player from an active sport_orgs player entry, hosting included", () => {
    expect(derive([aff("p1", "a", "player", { date_to: "2027-06-30" })], [])).toEqual([
      {
        clubId: "a",
        role: "player",
        sportnetRef: "sport_orgs:p1",
        validTo: new Date("2027-06-30"),
      },
    ]);
  });

  it("team manager from Vedúci družstva in both ISSF spellings (B6)", () => {
    const roles = derive(
      [],
      [aff("e1", "a", "Vedúci družstva"), aff("e2", "b", "Vedúci družstva / Tímový manažér")],
    );
    expect(roles.map((r) => [r.clubId, r.role])).toEqual([
      ["a", "team_manager"],
      ["b", "team_manager"],
    ]);
  });

  it("member from any other expert entry (code or ISSF name)", () => {
    const roles = derive([], [aff("e1", "a", "Lekár / Zdravotník"), aff("e2", "b", "functionary")]);
    expect(roles.map((r) => [r.clubId, r.role, r.sportnetRef])).toEqual([
      ["a", "member", "sport_expert_orgs:e1"],
      ["b", "member", "sport_expert_orgs:e2"],
    ]);
  });

  it("no coach from Sportnet (B1): a coach entry is only a member", () => {
    expect(derive([], [aff("e1", "a", "coach")])[0].role).toBe("member");
  });

  it("skips inactive entries, clubs not in the app and non-player sport_orgs", () => {
    expect(
      derive(
        [aff("p1", "a", "player", { isActive: false }), aff("p2", "a", "referee")],
        [aff("e1", "futbalsfz.sk", "coach"), aff("e2", "x", "Vedúci družstva"), { _id: "e3" }],
      ),
    ).toEqual([]);
  });
});

describe("strongestPerClub", () => {
  it("keeps one role per club: club_manager > team_manager > player > member", () => {
    const r = (clubId: string, role: "club_manager" | "team_manager" | "player" | "member") => ({
      clubId,
      role,
      sportnetRef: role,
    });
    const roles = strongestPerClub([
      r("a", "member"),
      r("a", "player"),
      r("b", "team_manager"),
      r("b", "club_manager"),
      r("c", "member"),
      r("c", "team_manager"),
    ]);
    expect(roles.map((x) => [x.clubId, x.role])).toEqual([
      ["a", "player"],
      ["b", "club_manager"],
      ["c", "team_manager"],
    ]);
  });
});

describe("planSportnetLinks", () => {
  const clubs = [
    { clubId: "a", role: "club_manager" as const, sportnetRef: "appspace:CRM" },
    {
      clubId: "b",
      role: "club_manager" as const,
      sportnetRef: "appspace:CRM",
      validTo: new Date("2027-01-01"),
    },
  ];

  it("creates a sportnet link per club for the season", () => {
    const links = planSportnetLinks({
      userId: "u1",
      season: "2026/2027",
      now: today,
      roles: clubs,
      appLinks: [],
    });
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      userId: "u1",
      clubId: "a",
      role: "club_manager",
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
      roles: clubs,
      appLinks: [
        { clubId: "a", role: "club_manager", season: "2026/2027" }, // old link without source = app
        { clubId: "b", role: "club_manager", season: "2025/2026", source: "app" },
        { clubId: "b", role: "club_manager", season: "2026/2027", source: "sportnet" },
      ],
    });
    expect(links.map((l) => l.clubId)).toEqual(["b"]);
  });
});

describe("sportnetRoleChanges", () => {
  it("lists only clubs whose roles changed", () => {
    expect(
      sportnetRoleChanges(
        [
          { clubId: "a", role: "coach" },
          { clubId: "b", role: "member" },
        ],
        [
          { clubId: "a", role: "coach" },
          { clubId: "b", role: "team_manager" },
          { clubId: "c", role: "player" },
        ],
      ),
    ).toEqual([
      { clubId: "b", from: ["member"], to: ["team_manager"] },
      { clubId: "c", from: [], to: ["player"] },
    ]);
    expect(sportnetRoleChanges([{ clubId: "a", role: "coach" }], [])).toEqual([
      { clubId: "a", from: ["coach"], to: [] },
    ]);
  });
});

describe("syncSportnetClubRoles", () => {
  const deps = (
    appspaces: SportnetMeAppspaces,
    affiliations: { sportOrgs: SportnetAffiliation[]; sportExpertOrgs: SportnetAffiliation[] } = {
      sportOrgs: [],
      sportExpertOrgs: [],
    },
    knownClubs: string[] = [],
  ): ClubRolesSyncDeps => ({
    fetchAppspaces: vi.fn(async () => appspaces),
    fetchAffiliations: vi.fn(async () => affiliations),
    listKnownClubIds: vi.fn(async (ids: string[]) => ids.filter((id) => knownClubs.includes(id))),
    insertMissingClubs: vi.fn(async (c) => c.length),
    listUserLinks: vi.fn(async () => []),
    replaceSportnetLinks: vi.fn(async () => {}),
    audit: memoryAudit(),
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
      expect.objectContaining({ clubId: "mfk-nova-bana.futbalnet.sk", role: "club_manager" }),
    ]);
    expect(result).toEqual({ clubs: 1, createdClubs: 1, links: 1 });
    expect((d.audit as ReturnType<typeof memoryAudit>).entries).toEqual([
      expect.objectContaining({
        action: "club.member.sportnet",
        source: "sportnet",
        actorId: "u1",
        clubId: "mfk-nova-bana.futbalnet.sk",
        target: { type: "user", id: "u1" },
        changes: { roles: { from: [], to: ["club_manager"] } },
      }),
    ]);
  });

  it("removes old sportnet links when the role is gone", async () => {
    const d = deps(me());
    await syncSportnetClubRoles(d, "u1", "token");
    expect(d.insertMissingClubs).not.toHaveBeenCalled();
    expect(d.replaceSportnetLinks).toHaveBeenCalledWith("u1", "2026/2027", []);
  });

  it("adds player, team manager and member roles in known clubs", async () => {
    const d = deps(
      me(crm("mfk-nova-bana.futbalnet.sk", "manager")),
      {
        sportOrgs: [aff("p1", "pilot-a", "player")],
        sportExpertOrgs: [
          aff("e1", "pilot-b", "Vedúci družstva"),
          aff("e2", "mfk-nova-bana.futbalnet.sk", "functionary"),
          aff("e3", "unknown-club", "functionary"),
        ],
      },
      ["pilot-a", "pilot-b", "mfk-nova-bana.futbalnet.sk"],
    );
    const result = await syncSportnetClubRoles(d, "u1", "token");
    expect(d.fetchAffiliations).toHaveBeenCalledWith("token");
    const links = vi.mocked(d.replaceSportnetLinks).mock.calls[0][2];
    expect(links.map((l) => [l.clubId, l.role, l.sportnetRef])).toEqual([
      ["mfk-nova-bana.futbalnet.sk", "club_manager", "appspace:CRM"],
      ["pilot-a", "player", "sport_orgs:p1"],
      ["pilot-b", "team_manager", "sport_expert_orgs:e1"],
    ]);
    expect(result).toEqual({ clubs: 1, createdClubs: 1, links: 3 });
  });

  it("keeps stored roles when Sportnet fails", async () => {
    const d = deps(me(crm("a", "admin")));
    vi.mocked(d.fetchAffiliations).mockRejectedValueOnce(new Error("Sportnet down"));
    await expect(syncSportnetClubRoles(d, "u1", "token")).rejects.toThrow("Sportnet down");
    expect(d.insertMissingClubs).not.toHaveBeenCalled();
    expect(d.replaceSportnetLinks).not.toHaveBeenCalled();
  });
});
