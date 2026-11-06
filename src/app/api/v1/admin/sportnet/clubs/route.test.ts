import { describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";

const getCurrentUser = vi.fn();
const store = {
  listClubsForImport: vi.fn(async () => []),
  applyClubImport: vi.fn(async () => {}),
  listClubsWithoutDetails: vi.fn(async () => []),
  countClubsWithoutDetails: vi.fn(async () => 0),
  listClubsForRefresh: vi.fn(async () => []),
  setClubDetails: vi.fn(async () => {}),
};

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  clubImportDeps: {
    store,
    fetchDirectory: async () => ({ clubs: [], tree: [] }),
    fetchProfile: async () => ({ relations: [] }),
    fetchLegalEntity: async () => ({}),
  },
}));

const clubs = await import("./route");
const details = await import("./details/route");

const req = (body?: unknown) =>
  new Request("http://localhost/api/v1/admin/sportnet/clubs", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = { params: Promise.resolve({}) } as never;

describe("POST /api/v1/admin/sportnet/clubs", () => {
  it("dry-run for admin_sfz, 403 for others", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await clubs.POST(req(), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ applied: false, created: 0 });
    expect(store.applyClubImport).not.toHaveBeenCalled();

    getCurrentUser.mockResolvedValue(alice);
    expect((await clubs.POST(req({ apply: true }), ctx)).status).toBe(403);
  });
});

describe("POST /api/v1/admin/sportnet/clubs/details", () => {
  it("counts the clubs left and validates the limit", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await details.POST(req({}), ctx);
    expect((await res.json()).data).toMatchObject({
      applied: false,
      remaining: 0,
      unionChanges: [],
    });
    expect((await details.POST(req({ apply: true, limit: 0 }), ctx)).status).toBe(400);
  });
});
