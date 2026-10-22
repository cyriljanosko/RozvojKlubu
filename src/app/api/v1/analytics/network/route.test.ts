import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryPlanStore } from "@/server/services/club-plan.fixture";
import { A, admin, alice, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryContentStore, memoryRoleCatalogStore } from "@/server/services/content.fixture";
import { seedContent } from "@/server/services/content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "@/server/services/kompas.fixture";
import { memoryLicensingSubmissionStore } from "@/server/services/licensing.fixture";
import { memoryVisitStore } from "@/server/services/mentor-visit.fixture";
import type { NetworkDeps } from "@/server/services/network.service";
import { seedRoleCatalog } from "@/server/services/role-catalog.service";

const getCurrentUser = vi.fn();
const holder: { deps: NetworkDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get networkDeps() {
    return holder.deps;
  },
}));

const route = await import("./route");
const get = (query = "") =>
  route.GET(new Request(`http://localhost/api/v1/analytics/network${query}`), {} as never);

describe("/api/v1/analytics/network", () => {
  beforeEach(async () => {
    const base = memoryDeps();
    const content = memoryContentStore();
    await seedContent(content, admin);
    const roleCatalog = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(
      roleCatalog,
      admin,
      JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8")),
    );
    holder.deps = {
      ...base,
      content,
      roleCatalog,
      kompas: { ...base, content, assessments: memoryAssessmentStore() },
      submissions: memorySubmissionStore(),
      licensingSubmissions: memoryLicensingSubmissionStore(),
      visits: memoryVisitStore(),
      plans: memoryPlanStore(),
    };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    getCurrentUser.mockReset();
  });

  it("returns the Academy map and the own club map", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const { data } = await (await get()).json();
    expect(data.map).toBe("academy");
    expect(data.nodes.length).toBeGreaterThan(11);
    const { data: club } = await (await get("?map=club")).json();
    expect(club).toMatchObject({ map: "club", people: true, club: { clubId: A } });
  });

  it("refuses anonymous (401), bad maps (400) and a club out of scope (404)", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    getCurrentUser.mockResolvedValue(admin);
    expect((await get("?map=people")).status).toBe(400);
    expect((await get("?map=club&club=nope")).status).toBe(404);
  });
});
