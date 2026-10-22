import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsDeps } from "@/server/services/analytics.service";
import { memoryPlanStore } from "@/server/services/club-plan.fixture";
import { A, B, admin, alice, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryContentStore } from "@/server/services/content.fixture";
import { memoryAssessmentStore, memorySubmissionStore } from "@/server/services/kompas.fixture";
import { memoryLicensingSubmissionStore } from "@/server/services/licensing.fixture";
import { memoryVisitStore } from "@/server/services/mentor-visit.fixture";

const getCurrentUser = vi.fn();
const holder: { deps: AnalyticsDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get analyticsDeps() {
    return holder.deps;
  },
}));

const route = await import("./route");
const get = (query = "") =>
  route.GET(new Request(`http://localhost/api/v1/analytics${query}`), {} as never);

describe("/api/v1/analytics", () => {
  beforeEach(async () => {
    const base = memoryDeps();
    holder.deps = {
      ...base,
      kompas: { ...base, content: memoryContentStore(), assessments: memoryAssessmentStore() },
      submissions: memorySubmissionStore(),
      licensingSubmissions: memoryLicensingSubmissionStore(),
      visits: memoryVisitStore(),
      plans: memoryPlanStore(),
    };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    getCurrentUser.mockReset();
  });

  it("returns panels by role and applies filters", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const { data } = await (await get(`?clubs=${encodeURIComponent(B)}`)).json();
    expect(data.scope).toBe("all");
    expect(data.clubs.map((c: { clubId: string }) => c.clubId)).toEqual([B]);
    getCurrentUser.mockResolvedValue(alice);
    const { data: own } = await (await get()).json();
    expect(own).toMatchObject({ scope: "club", average: null });
  });

  it("exports CSV with the same scope", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await get("?format=csv");
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/analyza-\d{4}-\d{4}\.csv/);
    const lines = (await res.text()).replace("\uFEFF", "").trim().split("\r\n");
    expect(lines[0].split(";")[0]).toBe("Klub");
    expect(lines).toHaveLength(2); // header + own club only
    expect(lines[1]).toContain(A);
    getCurrentUser.mockResolvedValue(null);
    expect((await get("?format=csv")).status).toBe(401);
  });

  it("refuses anonymous (401) and bad filters (400)", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    getCurrentUser.mockResolvedValue(admin);
    expect((await get("?size=huge")).status).toBe(400);
    expect((await get("?season=2026")).status).toBe(400);
    expect((await get("?format=xlsx")).status).toBe(400);
  });
});
