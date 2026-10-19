import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { admin, alice } from "@/server/services/clubs.fixture";
import { memoryContentStore, memoryRoleCatalogStore } from "@/server/services/content.fixture";
import { seedRoleCatalog } from "@/server/services/role-catalog.service";

const getCurrentUser = vi.fn();
const holder: { store: ReturnType<typeof memoryRoleCatalogStore> | null } = { store: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/db/content.store", () => ({
  get mongoRoleCatalogStore() {
    return holder.store;
  },
  get mongoContentStore() {
    return holder.store;
  },
}));

const roles = await import("./route");
const file = JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8"));
const req = (init?: RequestInit) => new Request("http://localhost/api/v1/roles", init);

describe("roles API", () => {
  beforeEach(async () => {
    holder.store = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(holder.store, admin, file);
    getCurrentUser.mockReset();
  });

  it("returns the catalog to everyone, also anonymous", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await roles.GET(req(), {} as never);
    expect(res.status).toBe(200);
    expect((await res.json()).data.content.areas).toHaveLength(11);
    getCurrentUser.mockResolvedValue(null);
    // public read (ADR 0011)
    expect((await roles.GET(req(), {} as never)).status).toBe(200);
  });

  it("lets only admin edit (403 otherwise), validates content (400)", async () => {
    const put = (body: unknown) =>
      roles.PUT(req({ method: "PUT", body: JSON.stringify(body) }), {} as never);
    getCurrentUser.mockResolvedValue(alice);
    expect((await put({ content: file, expectedVersion: 1 })).status).toBe(403);
    getCurrentUser.mockResolvedValue(admin);
    expect(
      (await put({ content: { ...file, areas: [{ area: 12 }] }, expectedVersion: 1 })).status,
    ).toBe(400);
    const changed = structuredClone(file);
    changed.areas[0].note = "Upravená poznámka";
    const ok = await put({ content: changed, expectedVersion: 1 });
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.version).toBe(2);
  });
});
