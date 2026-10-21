import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryPlanStore } from "@/server/services/club-plan.fixture";
import type { ClubPlanDeps } from "@/server/services/club-plan.service";
import { A, B, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryContentStore } from "@/server/services/content.fixture";
import { memoryAssessmentStore, memorySubmissionStore } from "@/server/services/kompas.fixture";

const getCurrentUser = vi.fn();
const holder: { deps: ClubPlanDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get planDeps() {
    return holder.deps;
  },
}));

const plan = await import("./route");
const goalRoute = await import("./goals/[goalId]/route");
const confirm = await import("./confirm/route");
const pub = await import("./public/route");

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/v1/x", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const goal = {
  area: 4,
  title: "Rebríček zapojenia dobrovoľníkov",
  publicText: "Chceme zapojiť viac rodičov do života klubu.",
  indicator: "",
  owner: "Alice",
  ownerId: "alice",
  dueDate: null,
  status: "todo",
};

describe("/api/v1/clubs/:clubId/plan", () => {
  beforeEach(async () => {
    const base = memoryDeps();
    holder.deps = {
      ...base,
      plans: memoryPlanStore(),
      submissions: memorySubmissionStore(),
      kompas: { ...base, content: memoryContentStore(), assessments: memoryAssessmentStore() },
    };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    getCurrentUser.mockReset();
  });

  it("management saves, sets a status; admin confirms; the public sees no names", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await plan.PUT(
      req("PUT", { goals: [goal], expectedVersion: 0 }),
      ctx({ clubId: A }),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const id = data.plan.goals[0].id;
    const status = await goalRoute.PATCH(
      req("PATCH", { status: "done", expectedVersion: 1 }),
      ctx({ clubId: A, goalId: id }),
    );
    expect((await status.json()).data.plan.goals[0].status).toBe("done");
    expect(
      (await confirm.POST(req("POST", { confirmed: true, expectedVersion: 2 }), ctx({ clubId: A })))
        .status,
    ).toBe(403);
    getCurrentUser.mockResolvedValue(admin);
    expect(
      (await confirm.POST(req("POST", { confirmed: true, expectedVersion: 2 }), ctx({ clubId: A })))
        .status,
    ).toBe(200);
    getCurrentUser.mockResolvedValue(null);
    const { data: p } = await (await pub.GET(req("GET"), ctx({ clubId: A }))).json();
    expect(p.goals).toEqual([{ area: 4, publicText: goal.publicText, status: "done" }]);
  });

  it("refuses coaches to save (403), other clubs (403), anonymous (401) and a missing public text (400)", async () => {
    getCurrentUser.mockResolvedValue(bob);
    expect((await plan.GET(req("GET"), ctx({ clubId: A }))).status).toBe(200);
    expect(
      (await plan.PUT(req("PUT", { goals: [], expectedVersion: 0 }), ctx({ clubId: A }))).status,
    ).toBe(403);
    expect((await plan.GET(req("GET"), ctx({ clubId: B }))).status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect((await plan.GET(req("GET"), ctx({ clubId: A }))).status).toBe(401);
    getCurrentUser.mockResolvedValue(alice);
    expect(
      (
        await plan.PUT(
          req("PUT", { goals: [{ ...goal, publicText: "" }], expectedVersion: 0 }),
          ctx({ clubId: A }),
        )
      ).status,
    ).toBe(400);
  });
});
