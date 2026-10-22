import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryMentoringStore } from "@/server/services/club-mentoring.fixture";
import type { MentoringDeps } from "@/server/services/club-mentoring.service";
import { A, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";

const getCurrentUser = vi.fn();
const holder: { deps: MentoringDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get mentoringDeps() {
    return holder.deps;
  },
}));

const view = await import("./route");
const part = await import("./[part]/route");
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const put = (body: unknown) =>
  new Request("http://localhost/api/v1/x", { method: "PUT", body: JSON.stringify(body) });
const intro = { strengths: "a", weaknesses: "b", improve: "c", expectations: "d" };

describe("/api/v1/clubs/:clubId/mentoring", () => {
  beforeEach(async () => {
    holder.deps = { ...memoryDeps(), mentoring: memoryMentoringStore() };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    getCurrentUser.mockReset();
  });

  it("management saves the intro, the coach reads it", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const saved = await part.PUT(
      put({ ...intro, expectedVersion: 0 }),
      ctx({ clubId: A, part: "intro" }),
    );
    expect((await saved.json()).data).toMatchObject({ version: 1, intro });
    getCurrentUser.mockResolvedValue(bob);
    const { data } = await (
      await view.GET(new Request("http://localhost/api/v1/x"), ctx({ clubId: A }))
    ).json();
    expect(data).toMatchObject({ role: "coach", writes: [], intro });
  });

  it("refuses anonymous (401), the coach writing (403), unknown parts (404) and conflicts (409)", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(
      (await view.GET(new Request("http://localhost/api/v1/x"), ctx({ clubId: A }))).status,
    ).toBe(401);
    getCurrentUser.mockResolvedValue(bob);
    expect(
      (await part.PUT(put({ ...intro, expectedVersion: 0 }), ctx({ clubId: A, part: "intro" })))
        .status,
    ).toBe(403);
    getCurrentUser.mockResolvedValue(alice);
    expect(
      (await part.PUT(put({ ...intro, expectedVersion: 0 }), ctx({ clubId: A, part: "nope" })))
        .status,
    ).toBe(404);
    await part.PUT(put({ ...intro, expectedVersion: 0 }), ctx({ clubId: A, part: "intro" }));
    expect(
      (await part.PUT(put({ ...intro, expectedVersion: 0 }), ctx({ clubId: A, part: "intro" })))
        .status,
    ).toBe(409);
  });
});
