import { describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";

const getCurrentUser = vi.fn();
const list = vi.fn(async () => ({
  entries: [
    {
      id: "a1",
      at: new Date("2026-11-07T10:00:00Z"),
      actorId: admin.id,
      actorRole: "admin_sfz",
      source: "user" as const,
      action: "user.role.change" as const,
      clubId: null,
      target: { type: "user", id: "u2" },
      changes: { role: { from: "public", to: "admin_sfz" } },
    },
  ],
  total: 1,
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  auditReadDeps: { audit: { list }, users: { findById: async () => admin } },
}));

const { GET } = await import("./route");

const ctx = { params: Promise.resolve({}) } as never;
const get = (query = "") => GET(new Request(`http://localhost/api/v1/admin/audit${query}`), ctx);

describe("GET /api/v1/admin/audit", () => {
  it("401 anonymous, 403 for others", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    getCurrentUser.mockResolvedValue(alice);
    expect((await get()).status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns entries with names and paging to admin_sfz, without caching", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await get("?clubId=club-a&page=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.meta).toEqual({ page: 1, pageSize: 50, total: 1, pages: 1 });
    expect(body.data.entries[0]).toMatchObject({
      actorName: admin.name,
      action: "user.role.change",
      changes: { role: { from: "public", to: "admin_sfz" } },
    });
    expect(list).toHaveBeenCalledWith({ clubId: "club-a" }, { skip: 0, limit: 50 });
  });

  it("400 for an unknown action", async () => {
    getCurrentUser.mockResolvedValue(admin);
    expect((await get("?action=drop")).status).toBe(400);
  });
});
