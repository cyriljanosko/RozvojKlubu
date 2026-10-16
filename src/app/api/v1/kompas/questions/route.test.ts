import { beforeEach, describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";
import { memoryContentStore } from "@/server/services/content.fixture";

const getCurrentUser = vi.fn();
const holder = { store: memoryContentStore() };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/db/content.store", () => ({
  get mongoContentStore() {
    return holder.store;
  },
}));

const questions = await import("./route");
const question = await import("./[questionId]/route");
const revisions = await import("./[questionId]/revisions/route");
const revert = await import("../revisions/[revisionId]/revert/route");
const areas = await import("../../areas/route");
const seed = await import("../../admin/content-seed/route");

const params = <T>(p: T) => ({ params: Promise.resolve(p) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const patch = (body: unknown) => ({ method: "PATCH", body: JSON.stringify(body) });

describe("content API", () => {
  beforeEach(async () => {
    holder.store = memoryContentStore();
    getCurrentUser.mockReset().mockResolvedValue(admin);
    expect(
      (await seed.POST(req("/api/v1/admin/content-seed", { method: "POST" }), {})).status,
    ).toBe(200);
  });

  it("seed is admin only", async () => {
    getCurrentUser.mockResolvedValue(alice);
    expect(
      (await seed.POST(req("/api/v1/admin/content-seed", { method: "POST" }), {})).status,
    ).toBe(403);
  });

  it("signed-in users read areas and questions, anonymous gets 401", async () => {
    getCurrentUser.mockResolvedValue(alice);
    expect((await (await areas.GET(req("/api/v1/areas"), {})).json()).data).toHaveLength(11);
    const res = await questions.GET(req("/api/v1/kompas/questions?area=4"), {});
    expect((await res.json()).data).toHaveLength(20);
    expect((await questions.GET(req("/api/v1/kompas/questions?area=x"), {})).status).toBe(400);
    getCurrentUser.mockResolvedValue(null);
    expect((await areas.GET(req("/api/v1/areas"), {})).status).toBe(401);
    expect((await questions.GET(req("/api/v1/kompas/questions"), {})).status).toBe(401);
  });

  it("admin edits, sees history and reverts; others get 403", async () => {
    const body = { text: "Nový text otázky", tags: ["D"], expectedVersion: 1 };
    getCurrentUser.mockResolvedValue(alice);
    expect(
      (
        await question.PATCH(
          req("/api/v1/kompas/questions/1.i.1", patch(body)),
          params({ questionId: "1.i.1" }),
        )
      ).status,
    ).toBe(403);

    getCurrentUser.mockResolvedValue(admin);
    const res = await question.PATCH(
      req("/api/v1/kompas/questions/1.i.1", patch(body)),
      params({ questionId: "1.i.1" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ text: "Nový text otázky", version: 2 });

    const stale = await question.PATCH(
      req("/api/v1/kompas/questions/1.i.1", patch(body)),
      params({ questionId: "1.i.1" }),
    );
    expect(stale.status).toBe(409);

    const hist = await revisions.GET(
      req("/api/v1/kompas/questions/1.i.1/revisions"),
      params({ questionId: "1.i.1" }),
    );
    const [rev] = (await hist.json()).data;
    const back = await revert.POST(
      req(`/api/v1/kompas/revisions/${rev.id}/revert`, { method: "POST" }),
      params({ revisionId: rev.id }),
    );
    expect(back.status).toBe(200);
    expect((await back.json()).data.version).toBe(3);
  });
});
