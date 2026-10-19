import { beforeEach, describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";
import { memoryContentStore, memorySectionStore } from "@/server/services/content.fixture";
import { seedMethodology } from "@/server/services/methodology.service";

const getCurrentUser = vi.fn();
const holder = { store: memorySectionStore(memoryContentStore()) };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/db/content.store", () => ({
  get mongoContentStore() {
    return holder.store;
  },
  get mongoSectionStore() {
    return holder.store;
  },
}));

const list = await import("./route");
const section = await import("./[key]/route");
const revisions = await import("./[key]/revisions/route");
const revert = await import("../../../methodology/revisions/[revisionId]/revert/route");

const params = <T>(p: T) => ({ params: Promise.resolve(p) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const edit = (expectedVersion: number) => ({
  method: "PATCH",
  body: JSON.stringify({
    title: "Popis",
    body: "Nový **text**",
    validAsOf: "2026-10-16",
    reviewedAt: "",
    expectedVersion,
  }),
});

describe("methodology API", () => {
  beforeEach(async () => {
    holder.store = memorySectionStore(memoryContentStore());
    await seedMethodology(holder.store, admin, [
      {
        area: 2,
        source: null,
        validAsOf: null,
        reviewedAt: null,
        sections: [{ key: "popis", order: 1, title: "Popis", body: "Pôvodný text" }],
      },
    ]);
    getCurrentUser.mockReset();
  });

  it("everyone reads sections (also anonymous), bad area 400", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await list.GET(req("/api/v1/areas/2/methodology"), params({ area: "2" }));
    expect((await res.json()).data).toMatchObject([{ key: "popis", body: "Pôvodný text" }]);
    expect((await list.GET(req("/api/v1/areas/x/methodology"), params({ area: "x" }))).status).toBe(
      400,
    );
    // public read (ADR 0011)
    getCurrentUser.mockResolvedValue(null);
    expect((await list.GET(req("/api/v1/areas/2/methodology"), params({ area: "2" }))).status).toBe(
      200,
    );
  });

  it("admin edits and reverts, others 403, stale version 409", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const p = params({ area: "2", key: "popis" });
    expect((await section.PATCH(req("/api/v1/areas/2/methodology/popis", edit(1)), p)).status).toBe(
      403,
    );

    getCurrentUser.mockResolvedValue(admin);
    const ok = await section.PATCH(req("/api/v1/areas/2/methodology/popis", edit(1)), p);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toMatchObject({
      version: 2,
      validAsOf: "2026-10-16",
      reviewedAt: null,
    });
    expect((await section.PATCH(req("/api/v1/areas/2/methodology/popis", edit(1)), p)).status).toBe(
      409,
    );

    const hist = await revisions.GET(req("/api/v1/areas/2/methodology/popis/revisions"), p);
    const [rev] = (await hist.json()).data;
    const back = await revert.POST(
      req(`/api/v1/methodology/revisions/${rev.id}/revert`, { method: "POST" }),
      params({ revisionId: rev.id }),
    );
    expect((await back.json()).data).toMatchObject({ body: "Pôvodný text", version: 3 });
  });
});
