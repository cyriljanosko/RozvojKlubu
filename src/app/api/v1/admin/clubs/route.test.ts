import { describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";

const getCurrentUser = vi.fn();
const searchClubs = vi.fn(async () => ({
  clubs: [{ clubId: "a", name: "Klub A", union: "ObFZ Trnava", region: "ZsFZ", status: "active" }],
  total: 1,
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  adminClubStore: {
    searchClubs,
    listUnions: async () => [],
    listActiveClubIds: async () => ["a"],
  },
}));

const { GET } = await import("./route");

const ctx = { params: Promise.resolve({}) } as never;
const url = (query = "") => new Request(`http://localhost/api/v1/admin/clubs${query}`);

describe("GET /api/v1/admin/clubs", () => {
  it("returns a page of clubs with paging in meta to admin_sfz", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await GET(url("?region=ZsFZ&page=1"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.clubs).toEqual([expect.objectContaining({ clubId: "a", inApp: true })]);
    expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 1, pages: 1 });
    expect(searchClubs).toHaveBeenCalledWith(
      { region: "ZsFZ", status: "active" },
      { skip: 0, limit: 25 },
    );
  });

  it("refuses other users and rejects invalid filters", async () => {
    getCurrentUser.mockResolvedValue(alice);
    expect((await GET(url(), ctx)).status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect((await GET(url(), ctx)).status).toBe(401);
    getCurrentUser.mockResolvedValue(admin);
    const bad = await GET(url("?status=deleted"), ctx);
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("BAD_REQUEST");
  });
});
