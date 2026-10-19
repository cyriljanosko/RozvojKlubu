import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { admin, memoryDeps } from "@/server/services/clubs.fixture";
import {
  memoryContentStore,
  memoryPracticeStore,
  memoryRoleCatalogStore,
  memorySectionStore,
} from "@/server/services/content.fixture";
import { seedContent } from "@/server/services/content.service";
import { seedPractice } from "@/server/services/practice.service";
import { seedRoleCatalog } from "@/server/services/role-catalog.service";
import type { SearchDeps } from "@/server/services/search.service";

const getCurrentUser = vi.fn();
const holder: { deps: SearchDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get searchDeps() {
    return holder.deps;
  },
}));

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const route = await import("./route");
const get = (q: string) =>
  route.GET(new Request(`http://localhost/api/v1/search?q=${encodeURIComponent(q)}`), {} as never);

describe("/api/v1/search", () => {
  beforeAll(async () => {
    const content = memoryContentStore();
    await seedContent(content, admin);
    const practice = memoryPracticeStore(memoryContentStore());
    await seedPractice(practice, admin, [JSON.parse(read("content/prax/03.json"))]);
    const roleCatalog = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(roleCatalog, admin, JSON.parse(read("content/roly.json")));
    holder.deps = {
      ...memoryDeps(),
      content,
      sections: memorySectionStore(memoryContentStore()),
      practice,
      roleCatalog,
    };
  });

  it("is public and returns ranked hits", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await get("dobrovolnici");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.query).toBe("dobrovolnici");
    expect(data.hits[0]).toMatchObject({ kind: "area", href: "/oblasti/4" });
  });

  it("returns no hits for an empty query and 400 for a too long one", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await (await get("")).json()).data.hits).toEqual([]);
    expect((await get("x".repeat(101))).status).toBe(400);
  });
});
