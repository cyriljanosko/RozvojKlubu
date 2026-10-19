import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryContentStore, memoryPracticeStore } from "@/server/services/content.fixture";
import { memoryProgressStore } from "@/server/services/practice-progress.fixture";
import type { PracticeProgressDeps } from "@/server/services/practice-progress.service";
import { seedPractice } from "@/server/services/practice.service";

const getCurrentUser = vi.fn();
const holder: { deps: PracticeProgressDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get progressDeps() {
    return holder.deps;
  },
}));

const file = JSON.parse(readFileSync(join(process.cwd(), "content/prax/03.json"), "utf8"));
const route = await import("./route");
const params = (clubId: string, area: string) =>
  ({ params: Promise.resolve({ clubId, area }) }) as never;
const url = (clubId: string, area: string) =>
  `http://localhost/api/v1/clubs/${clubId}/practice/${area}`;
const put = (clubId: string, area: string, body: unknown) =>
  route.PUT(
    new Request(url(clubId, area), { method: "PUT", body: JSON.stringify(body) }),
    params(clubId, area),
  );
const get = (clubId: string, area: string) =>
  route.GET(new Request(url(clubId, area)), params(clubId, area));

describe("/api/v1/clubs/:clubId/practice/:area", () => {
  beforeEach(async () => {
    const practice = memoryPracticeStore(memoryContentStore());
    await seedPractice(practice, admin, [file]);
    holder.deps = { ...memoryDeps(), practice, progress: memoryProgressStore() };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    getCurrentUser.mockReset();
  });

  it("management saves progress and reads it back", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await put(A, "3", {
      tasks: ["v1"],
      steps: [{ stepId: "vs1", option: 0, done: true }],
      expectedVersion: 0,
    });
    expect(res.status).toBe(200);
    const { data } = await (await get(A, "3")).json();
    expect(data).toMatchObject({ version: 1, access: "edit", tasks: ["v1"] });
    expect(data.roles[0]).toMatchObject({ roleId: "v", stepsDone: 1, nextStepId: "vs2" });
    expect((await put(A, "3", { tasks: [], steps: [], expectedVersion: 0 })).status).toBe(409);
    expect((await put(A, "3", { tasks: ["x9"], steps: [], expectedVersion: 1 })).status).toBe(400);
    expect((await get(A, "5")).status).toBe(404);
  });

  it("refuses other clubs (403), people without a club role (403) and anonymous (401)", async () => {
    getCurrentUser.mockResolvedValue(alice);
    expect((await get(B, "3")).status).toBe(403);
    getCurrentUser.mockResolvedValue(bob);
    expect((await put(A, "3", { tasks: [], steps: [], expectedVersion: 0 })).status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect((await get(A, "3")).status).toBe(401);
  });
});
