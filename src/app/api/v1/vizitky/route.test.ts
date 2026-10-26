import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryPlanStore } from "@/server/services/club-plan.fixture";
import { memoryClubSettingsStore } from "@/server/services/club-settings.fixture";
import { A, admin, memoryDeps } from "@/server/services/clubs.fixture";
import { memoryContentStore } from "@/server/services/content.fixture";
import { memoryAssessmentStore, memorySubmissionStore } from "@/server/services/kompas.fixture";
import {
  memoryEvaluationStore,
  memoryLicensingSubmissionStore,
} from "@/server/services/licensing.fixture";
import { memoryVisitStore } from "@/server/services/mentor-visit.fixture";
import type { RankingsDeps } from "@/server/services/vizitky.service";

const getCurrentUser = vi.fn();
const holder: { deps: RankingsDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get rankingsDeps() {
    return holder.deps;
  },
}));

const route = await import("./route");
const get = () => route.GET(new Request("http://localhost/api/v1/vizitky"), {} as never);

describe("Vizitky API (MR-b)", () => {
  beforeEach(() => {
    holder.deps = {
      ...memoryDeps(),
      content: memoryContentStore(),
      assessments: memoryAssessmentStore(),
      submissions: memorySubmissionStore(),
      evaluations: memoryEvaluationStore(),
      licensingSubmissions: memoryLicensingSubmissionStore(),
      settings: memoryClubSettingsStore(),
      plans: memoryPlanStore(),
      visits: memoryVisitStore(),
    };
    getCurrentUser.mockReset();
  });

  it("is public: every club without ratings when nobody consented", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.viewer).toEqual({ positions: [], own: [] });
    expect(data.cards.find((c: { clubId: string }) => c.clubId === A)).toMatchObject({
      ranked: false,
      kompasStars: null,
    });
  });

  it("admin_sfz may see every position", async () => {
    getCurrentUser.mockResolvedValue(admin);
    expect((await (await get()).json()).data.viewer.positions).toBe("all");
  });
});
