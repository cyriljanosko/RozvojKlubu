import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleSnapshot } from "@/server/services/club-snapshot.fixture";
import { A, B, admin, alice, memoryDeps } from "@/server/services/clubs.fixture";

const getCurrentUser = vi.fn();
const deps = { current: memoryDeps() };
const saveSnapshot = vi.fn();

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get clubDeps() {
    return deps.current;
  },
}));
vi.mock("@/server/db/clubs.store", () => ({ mongoSnapshotStore: { saveSnapshot } }));

const clubs = await import("./route");
const club = await import("./[clubId]/route");
const members = await import("./[clubId]/members/route");
const member = await import("./[clubId]/members/[membershipId]/route");
const snapshot = await import("../admin/club-snapshot/route");

const params = <T>(p: T) => ({ params: Promise.resolve(p) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

describe("/api/v1/clubs", () => {
  beforeEach(() => {
    deps.current = memoryDeps();
    getCurrentUser.mockReset();
    saveSnapshot.mockReset().mockResolvedValue({ clubs: 1, seasons: 1 });
  });

  it("GET /clubs: 401 anonymous, empty for non-members, all for admin", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await clubs.GET(req("/api/v1/clubs"), {})).status).toBe(401);
    getCurrentUser.mockResolvedValue(alice);
    expect((await (await clubs.GET(req("/api/v1/clubs"), {})).json()).data).toEqual([]);
    getCurrentUser.mockResolvedValue(admin);
    const data = (await (await clubs.GET(req("/api/v1/clubs"), {})).json()).data;
    expect(data.map((c: { clubId: string }) => c.clubId)).toEqual([B, A]);
  });

  it("member flow: admin adds a member, the member opens only their club", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const created = await members.POST(
      req(`/api/v1/clubs/${A}/members`, json({ email: "alice@klub.sk", role: "management" })),
      params({ clubId: A }),
    );
    expect(created.status).toBe(201);
    const { data: m } = await created.json();

    getCurrentUser.mockResolvedValue(alice);
    const ok = await club.GET(req(`/api/v1/clubs/${A}`), params({ clubId: A }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({ club: { clubId: A }, roles: ["management"] });
    expect((await club.GET(req(`/api/v1/clubs/${B}`), params({ clubId: B }))).status).toBe(403);

    // a member cannot manage members
    expect(
      (await members.GET(req(`/api/v1/clubs/${A}/members`), params({ clubId: A }))).status,
    ).toBe(403);
    expect(
      (
        await member.DELETE(
          req(`/api/v1/clubs/${A}/members/${m.id}`, { method: "DELETE" }),
          params({ clubId: A, membershipId: m.id }),
        )
      ).status,
    ).toBe(403);

    getCurrentUser.mockResolvedValue(admin);
    const removed = await member.DELETE(
      req(`/api/v1/clubs/${A}/members/${m.id}`, { method: "DELETE" }),
      params({ clubId: A, membershipId: m.id }),
    );
    expect(removed.status).toBe(204);
  });

  it("validates input", async () => {
    getCurrentUser.mockResolvedValue(admin);
    expect(
      (await club.GET(req(`/api/v1/clubs/${A}?season=2026`), params({ clubId: A }))).status,
    ).toBe(400);
    expect(
      (
        await members.POST(
          req(`/api/v1/clubs/${A}/members`, json({ email: "x", role: "coach" })),
          params({ clubId: A }),
        )
      ).status,
    ).toBe(400);
    expect((await club.GET(req("/api/v1/clubs/nope"), params({ clubId: "nope" }))).status).toBe(
      404,
    );
  });

  it("POST /admin/club-snapshot: admin only", async () => {
    getCurrentUser.mockResolvedValue(alice);
    expect(
      (await snapshot.POST(req("/api/v1/admin/club-snapshot", json(sampleSnapshot)), {})).status,
    ).toBe(403);
    expect(saveSnapshot).not.toHaveBeenCalled();
    getCurrentUser.mockResolvedValue(admin);
    const res = await snapshot.POST(req("/api/v1/admin/club-snapshot", json(sampleSnapshot)), {});
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ dataAsOf: "2026-10-11", clubs: 1, seasons: 1 });
    expect(
      (await snapshot.POST(req("/api/v1/admin/club-snapshot", json({ clubs: [] })), {})).status,
    ).toBe(400);
  });
});
