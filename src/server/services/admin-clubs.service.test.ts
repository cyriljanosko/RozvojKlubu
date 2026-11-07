import { describe, expect, it, vi } from "vitest";

import { admin, alice } from "./clubs.fixture";
import {
  ADMIN_CLUBS_PAGE_SIZE,
  listAdminClubs,
  searchPattern,
  type AdminClubRecord,
  type AdminClubStore,
} from "./admin-clubs.service";

const club = (clubId: string, extra: Partial<AdminClubRecord> = {}): AdminClubRecord => ({
  clubId,
  name: `Klub ${clubId}`,
  union: "ObFZ Trnava",
  region: "ZsFZ",
  status: "active",
  ...extra,
});

function store(clubs: AdminClubRecord[] = [club("a"), club("b")], total = clubs.length) {
  return {
    searchClubs: vi.fn<AdminClubStore["searchClubs"]>(async () => ({ clubs, total })),
    listUnions: vi.fn<AdminClubStore["listUnions"]>(async () => [
      { unionId: "obfz-trnava", union: "ObFZ Trnava", region: "ZsFZ" },
    ]),
    listActiveClubIds: vi.fn(async () => ["a"]),
  } satisfies AdminClubStore;
}

describe("searchPattern", () => {
  it("ignores Slovak diacritics and case", () => {
    const re = new RegExp(searchPattern("nova bana"), "i");
    expect(re.test("MFK Nová Baňa")).toBe(true);
    expect(new RegExp(searchPattern("Žilina"), "i").test("MŠK ZILINA")).toBe(true);
  });

  it("escapes regex characters", () => {
    expect(new RegExp(searchPattern("a.s."), "i").test("FK ABSC")).toBe(false);
    expect(new RegExp(searchPattern("(o. z.)"), "i").test("Klub (o. z.)")).toBe(true);
  });
});

describe("listAdminClubs", () => {
  it("lists active clubs by default with the app flag and page info", async () => {
    const s = store(
      [club("a"), club("b", { sportnetDetailsAt: new Date("2026-11-06T02:00:00Z") })],
      60,
    );
    const result = await listAdminClubs(s, admin, {});
    expect(s.searchClubs).toHaveBeenCalledWith(
      { status: "active" },
      { skip: 0, limit: ADMIN_CLUBS_PAGE_SIZE },
    );
    expect(result.clubs.map((c) => [c.clubId, c.inApp])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(result.clubs[1].detailsAt).toBe("2026-11-06T02:00:00.000Z");
    expect(result.page).toEqual({ page: 1, pageSize: 25, total: 60, pages: 3 });
  });

  it("maps the URL filters to the store filter", async () => {
    const s = store();
    await listAdminClubs(s, admin, {
      q: " nová ",
      region: "ZsFZ",
      union: "obfz-trnava",
      status: "all",
      inApp: "no",
      page: "3",
    });
    expect(s.searchClubs).toHaveBeenCalledWith(
      {
        namePattern: searchPattern("nová"),
        region: "ZsFZ",
        unionId: "obfz-trnava",
        clubIds: { nin: ["a"] },
      },
      { skip: 50, limit: 25 },
    );
    expect(s.listUnions).toHaveBeenCalledWith("ZsFZ");
  });

  it("searches by IČO prefix when the text is a number; clubs without region", async () => {
    const s = store();
    await listAdminClubs(s, admin, { q: "170 674", region: "none", inApp: "yes" });
    expect(s.searchClubs).toHaveBeenCalledWith(
      { businessIdPrefix: "170674", region: "none", status: "active", clubIds: { in: ["a"] } },
      expect.anything(),
    );
    expect(s.listUnions).toHaveBeenCalledWith(undefined);
  });

  it("refuses users without admin_sfz and invalid filters", async () => {
    await expect(listAdminClubs(store(), alice, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listAdminClubs(store(), null, {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(listAdminClubs(store(), admin, { region: "XY" })).rejects.toThrow();
    await expect(listAdminClubs(store(), admin, { page: "0" })).rejects.toThrow();
  });
});
