import { describe, expect, it, vi } from "vitest";

import type { SportnetPpoNode, SportnetRelation } from "@/server/integrations/sportnet/ppo";

import { admin, alice } from "./clubs.fixture";
import {
  clubUnionOf,
  fillClubDetails,
  importSportnetClubs,
  planClubImport,
  syncSportnetClubs,
  unionIndex,
  type ClubImportDeps,
} from "./club-import.service";

const now = new Date("2026-11-06T18:00:00Z");

const rel = (related_ppo: string, type = "matricity", status: string | null = "active") => ({
  related_ppo,
  type,
  status,
});

const tree: SportnetPpoNode[] = [
  {
    _id: "futbalsfz.sk",
    subs: [
      {
        _id: "obfz-ziar",
        name: "Oblastný futbalový zväz Žiar nad Hronom",
        shortNames: [{ shortname: "ObFZ Žiar nad Hronom" }],
        relations: [rel("SsFZ")],
        subs: [{ _id: "mfk-nova-bana.futbalnet.sk" }],
      },
      { _id: "SsFZ", shortNames: [{ shortname: "SsFZ" }], relations: [rel("futbalsfz.sk")] },
      { _id: "VsFZ", shortNames: [{ shortname: "VsFZ" }], relations: [rel("futbalsfz.sk")] },
      { _id: "lfz", name: "Liptovský futbalový zväz", relations: [rel("SsFZ")] },
      { _id: "ulk", shortNames: [{ shortname: "ÚLK" }], relations: [rel("futbalsfz.sk")] },
    ],
  },
];
const unions = unionIndex(tree);
const profile = (...relations: SportnetRelation[]) => ({ relations });

describe("unionIndex", () => {
  it("short name, else full name; region of the union", () => {
    expect(unions.get("obfz-ziar")).toEqual({ name: "ObFZ Žiar nad Hronom", regionId: "SsFZ" });
    expect(unions.get("SsFZ")).toEqual({ name: "SsFZ", regionId: "SsFZ" });
    expect(unions.get("lfz")).toEqual({ name: "Liptovský futbalový zväz", regionId: "SsFZ" });
    expect(unions.get("ulk")).toEqual({ name: "ÚLK", regionId: "" });
  });
});

describe("clubUnionOf (matricity from the club's own profile)", () => {
  it("prefers the ObFZ-level union over the regional union", () => {
    expect(
      clubUnionOf(profile(rel("obfz-ziar"), rel("SsFZ"), rel("futbalsfz.sk", "other")), unions),
    ).toEqual({
      unionId: "obfz-ziar",
      union: "ObFZ Žiar nad Hronom",
      regionId: "SsFZ",
    });
  });

  // Regression (dry-run 6. 11.): the union tree placed ŠKM Liptovský Hrádok under SsFZ although
  // its matricity is LFZ Liptovský Mikuláš.
  it("takes the region from the union when the club has no regional matricity", () => {
    expect(clubUnionOf(profile(rel("SsFZ", "other"), rel("lfz")), unions)).toEqual({
      unionId: "lfz",
      union: "Liptovský futbalový zväz",
      regionId: "SsFZ",
    });
  });

  it("a club registered directly with the regional union", () => {
    expect(clubUnionOf(profile(rel("VsFZ")), unions)).toEqual({
      unionId: "VsFZ",
      union: "VsFZ",
      regionId: "VsFZ",
    });
  });

  it("ÚLK club: union ÚLK, no region; inactive relations are ignored", () => {
    expect(
      clubUnionOf(
        profile(rel("ulk"), rel("futbalsfz.sk"), rel("obfz-ziar", "matricity", null)),
        unions,
      ),
    ).toEqual({ unionId: "ulk", union: "ÚLK", regionId: "" });
    expect(clubUnionOf(profile(rel("x", "other")), unions)).toBeNull();
  });
});

const ppo = (_id: string, status: string | null = "active", extra = {}) => ({
  _id,
  name: ` Klub ${_id} `,
  type: "club",
  sport: "futbal",
  status,
  logo_public_url: `https://api.sportnet.online/data/ppo/${_id}/logo.png`,
  ...extra,
});

describe("planClubImport", () => {
  const clubs = [
    ppo("new"),
    ppo("stored"),
    ppo("gone", "excluded"),
    ppo("stored-gone", "excluded"),
    ppo("futsal", "active", { sport: "futsal" }),
    ppo("new"),
  ];

  it("creates active clubs without union yet and refreshes stored ones", () => {
    const plan = planClubImport({
      clubs,
      now,
      existing: [{ clubId: "stored" }, { clubId: "stored-gone" }],
    });
    expect(plan.create).toEqual([
      {
        clubId: "new",
        name: "Klub new",
        union: "",
        region: "",
        slug: "",
        source: "sportnet",
        status: "active",
        logoUrl: "https://api.sportnet.online/data/ppo/new/logo.png",
        dataAsOf: "2026-11-06",
        importedAt: now,
        sportnetSyncedAt: now,
      },
    ]);
    // a stored club keeps union, slug and source; one no longer active gets the new status
    expect(plan.update).toEqual([
      { clubId: "stored", set: expect.objectContaining({ status: "active", name: "Klub stored" }) },
      { clubId: "stored-gone", set: expect.objectContaining({ status: "excluded" }) },
    ]);
    expect(plan.update[0].set).not.toHaveProperty("union");
    expect(plan.skipped).toBe(2); // excluded and not stored, futsal; the duplicate is ignored
  });
});

function deps(): ClubImportDeps {
  return {
    store: {
      listClubsForImport: vi.fn(async () => []),
      applyClubImport: vi.fn(async () => {}),
      listClubsWithoutDetails: vi.fn(async () => [
        { clubId: "mfk-nova-bana.futbalnet.sk", name: "MFK Nová Baňa", union: "", region: "" },
        { clubId: "broken", name: "Broken", union: "X", region: "" },
      ]),
      countClubsWithoutDetails: vi.fn(async () => 7),
      listClubsForRefresh: vi.fn(async () => [
        { clubId: "mfk-nova-bana.futbalnet.sk", name: "MFK Nová Baňa", union: "", region: "" },
        { clubId: "broken", name: "Broken", union: "X", region: "" },
      ]),
      setClubDetails: vi.fn(async () => {}),
    },
    fetchDirectory: vi.fn(async () => ({ tree, clubs: [ppo("new")] })),
    fetchProfile: vi.fn(async (id: string) => {
      if (id === "broken") throw new Error("Sportnet 500");
      return profile(rel("obfz-ziar"), rel("SsFZ"));
    }),
    fetchLegalEntity: vi.fn(async () => ({
      businessId: "17067481",
      legalForm: "701",
      legalName: "Mestský futbalový klub Nová Baňa",
    })),
    now: () => now,
  };
}

describe("importSportnetClubs", () => {
  it("is admin_sfz only", async () => {
    await expect(importSportnetClubs(deps(), alice, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(importSportnetClubs(deps(), null, {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("is a dry-run unless apply is true", async () => {
    const d = deps();
    expect(await importSportnetClubs(d, admin, {})).toEqual({
      applied: false,
      sportnetClubs: 1,
      created: 1,
      updated: 0,
      skipped: 0,
    });
    expect(d.store.applyClubImport).not.toHaveBeenCalled();
    await importSportnetClubs(d, admin, { apply: true });
    expect(d.store.applyClubImport).toHaveBeenCalledOnce();
  });
});

describe("fillClubDetails", () => {
  it("dry-run shows the union changes of the batch without writing", async () => {
    const d = deps();
    const r = await fillClubDetails(d, admin, { limit: 2 });
    expect(r).toEqual({
      applied: false,
      checked: 1,
      failed: 1,
      remaining: 7,
      unionChanges: [
        {
          clubId: "mfk-nova-bana.futbalnet.sk",
          name: "MFK Nová Baňa",
          from: "",
          to: "ObFZ Žiar nad Hronom",
          region: "SsFZ",
        },
      ],
    });
    expect(d.store.listClubsWithoutDetails).toHaveBeenCalledWith(2);
    expect(d.store.setClubDetails).not.toHaveBeenCalled();
  });

  it("apply writes union, region and the legal entity, skipping a failing club", async () => {
    const d = deps();
    await fillClubDetails(d, admin, { apply: true });
    expect(d.store.setClubDetails).toHaveBeenCalledOnce();
    expect(d.store.setClubDetails).toHaveBeenCalledWith("mfk-nova-bana.futbalnet.sk", {
      union: "ObFZ Žiar nad Hronom",
      region: "SsFZ",
      unionId: "obfz-ziar",
      regionId: "SsFZ",
      businessId: "17067481",
      legalForm: "701",
      legalName: "Mestský futbalový klub Nová Baňa",
      sportnetDetailsAt: now,
    });
  });

  it("a club without an active matricity keeps its union and region", async () => {
    const d = deps();
    d.store.listClubsWithoutDetails = vi.fn(async () => [
      { clubId: "x", name: "X", union: "ObFZ Galanta", region: "ZsFZ" },
    ]);
    d.fetchProfile = vi.fn(async () => profile(rel("obfz-ziar", "matricity", "inactive")));
    const r = await fillClubDetails(d, admin, { apply: true });
    expect(r.unionChanges).toEqual([]);
    expect(d.store.setClubDetails).toHaveBeenCalledWith(
      "x",
      expect.objectContaining({ union: "ObFZ Galanta", region: "ZsFZ", unionId: "" }),
    );
  });

  it("rejects a limit out of range and non-admins", async () => {
    await expect(fillClubDetails(deps(), admin, { limit: 1000 })).rejects.toThrow();
    await expect(fillClubDetails(deps(), alice, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("syncSportnetClubs (nightly cron)", () => {
  it("writes the directory and refreshes the details of the batch", async () => {
    const d = deps();
    expect(await syncSportnetClubs(d)).toEqual({
      sportnetClubs: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      checked: 1,
      failed: 1,
      unionChanges: 1,
      remaining: 7,
    });
    expect(d.store.applyClubImport).toHaveBeenCalledOnce();
    expect(d.store.listClubsForRefresh).toHaveBeenCalledWith(600);
    expect(d.store.setClubDetails).toHaveBeenCalledOnce();
    // one directory read for both steps
    expect(d.fetchDirectory).toHaveBeenCalledOnce();
  });

  it("stops reading details when the time budget is spent", async () => {
    const d = deps();
    const r = await syncSportnetClubs(d, { limit: 10, budgetMs: 0 });
    expect(r).toMatchObject({ created: 1, checked: 0, failed: 0 });
    expect(d.fetchProfile).not.toHaveBeenCalled();
    expect(d.store.listClubsForRefresh).toHaveBeenCalledWith(10);
  });
});
