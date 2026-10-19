import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";
import { memoryContentStore, memoryPracticeStore } from "@/server/services/content.fixture";
import { seedPractice } from "@/server/services/practice.service";

const getCurrentUser = vi.fn();
const holder = { store: memoryPracticeStore(memoryContentStore()) };
const file = JSON.parse(readFileSync(join(process.cwd(), "content/prax/04.json"), "utf8"));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/db/content.store", () => ({
  get mongoContentStore() {
    return holder.store;
  },
  get mongoPracticeStore() {
    return holder.store;
  },
}));

const route = await import("./route");
const revisions = await import("./revisions/route");
const revert = await import("../../../practice/revisions/[revisionId]/revert/route");

const params = <T>(p: T) => ({ params: Promise.resolve(p) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);

describe("practice API", () => {
  beforeEach(async () => {
    holder.store = memoryPracticeStore(memoryContentStore());
    await seedPractice(holder.store, admin, [file]);
    getCurrentUser.mockReset();
  });

  it("everyone reads practice (also anonymous); 404 for areas without it", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await route.GET(req("/api/v1/areas/4/practice"), params({ area: "4" }));
    expect((await res.json()).data.content.roles.map((r: { id: string }) => r.id)).toEqual([
      "v",
      "t",
      "r",
      "h",
      "m",
    ]);
    expect((await route.GET(req("/api/v1/areas/5/practice"), params({ area: "5" }))).status).toBe(
      404,
    );
    // public read (ADR 0011)
    getCurrentUser.mockResolvedValue(null);
    expect((await route.GET(req("/api/v1/areas/4/practice"), params({ area: "4" }))).status).toBe(
      200,
    );
  });

  it("admin replaces practice with validation, others 403; history and revert", async () => {
    const put = (body: unknown) =>
      route.PUT(
        req("/api/v1/areas/4/practice", { method: "PUT", body: JSON.stringify(body) }),
        params({ area: "4" }),
      );
    const content = {
      roles: file.roles,
      templates: file.templates,
      mentorModules: file.mentorModules,
    };
    content.roles = structuredClone(file.roles);
    content.roles[0].pathTitle = "Iný názov";

    getCurrentUser.mockResolvedValue(alice);
    expect(
      (await put({ content, validAsOf: null, reviewedAt: null, expectedVersion: 1 })).status,
    ).toBe(403);

    getCurrentUser.mockResolvedValue(admin);
    expect(
      (await put({ content: { roles: [] }, validAsOf: null, reviewedAt: null, expectedVersion: 1 }))
        .status,
    ).toBe(400);
    const ok = await put({ content, validAsOf: null, reviewedAt: null, expectedVersion: 1 });
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.version).toBe(2);

    const [rev] = (
      await (
        await revisions.GET(req("/api/v1/areas/4/practice/revisions"), params({ area: "4" }))
      ).json()
    ).data;
    const back = await revert.POST(
      req(`/api/v1/practice/revisions/${rev.id}/revert`, { method: "POST" }),
      params({ revisionId: rev.id }),
    );
    expect((await back.json()).data.content.roles[0].pathTitle).toBe(file.roles[0].pathTitle);
  });
});
