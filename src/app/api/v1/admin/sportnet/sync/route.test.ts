import { describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";

const getCurrentUser = vi.fn();
const insertRun = vi.fn(async () => {});

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  syncRunDeps: {
    clubs: {
      store: {
        listClubsForImport: async () => [],
        applyClubImport: async () => {},
        listClubsWithoutDetails: async () => [],
        countClubsWithoutDetails: async () => 0,
        listClubsForRefresh: async () => [],
        setClubDetails: async () => {},
      },
      fetchDirectory: async () => ({ clubs: [], tree: [] }),
      fetchProfile: async () => ({ relations: [] }),
      fetchLegalEntity: async () => ({}),
    },
    runs: { insertRun, listRuns: async () => [] },
    stats: async () => ({ activeClubs: 3, withoutDetails: 1, oldestDetailsAt: null }),
  },
}));

const { GET, POST } = await import("./route");

const url = "http://localhost/api/v1/admin/sportnet/sync";
const ctx = { params: Promise.resolve({}) } as never;

describe("/api/v1/admin/sportnet/sync", () => {
  it("GET returns the sync state to admin_sfz, 403 to others", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await GET(new Request(url), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      clubs: { activeClubs: 3, withoutDetails: 1, oldestDetailsAt: null },
      runs: [],
    });
    getCurrentUser.mockResolvedValue(alice);
    expect((await GET(new Request(url), ctx)).status).toBe(403);
  });

  it("POST is a dry-run without apply and records an applied run", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const dry = await POST(new Request(url, { method: "POST" }), ctx);
    expect((await dry.json()).data).toMatchObject({ applied: false });
    expect(insertRun).not.toHaveBeenCalled();
    const body = JSON.stringify({ apply: true });
    const run = await POST(new Request(url, { method: "POST", body }), ctx);
    expect((await run.json()).data).toMatchObject({ applied: true });
    expect(insertRun).toHaveBeenCalledOnce();
  });

  it("POST refuses a user without admin_sfz", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const body = JSON.stringify({ apply: true });
    expect((await POST(new Request(url, { method: "POST", body }), ctx)).status).toBe(403);
  });
});
