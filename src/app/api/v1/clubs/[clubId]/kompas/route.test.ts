import { beforeEach, describe, expect, it, vi } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryContentStore } from "@/server/services/content.fixture";
import { seedContent } from "@/server/services/content.service";
import { memoryAssessmentStore } from "@/server/services/kompas.fixture";
import type { KompasDeps } from "@/server/services/kompas.service";

const getCurrentUser = vi.fn();
const holder: { deps: KompasDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get kompasDeps() {
    return holder.deps;
  },
}));

const route = await import("./route");
const params = (clubId: string) => ({ params: Promise.resolve({ clubId }) }) as never;
const put = (clubId: string, body: unknown) =>
  route.PUT(
    new Request(`http://localhost/api/v1/clubs/${clubId}/kompas`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    params(clubId),
  );
const get = (clubId: string) =>
  route.GET(new Request(`http://localhost/api/v1/clubs/${clubId}/kompas`), params(clubId));

describe("/api/v1/clubs/:clubId/kompas", () => {
  beforeEach(async () => {
    const content = memoryContentStore();
    await seedContent(content, admin);
    holder.deps = { ...memoryDeps(), content, assessments: memoryAssessmentStore() };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    getCurrentUser.mockReset();
  });

  it("management saves and reads the result", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await put(A, { answers: ["2.i.1", "2.s.1"], expectedVersion: 0 });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ version: 1, access: "edit" });
    expect(data.questions.filter((q: { checked: boolean }) => q.checked)).toHaveLength(2);
    expect((await put(A, { answers: [], expectedVersion: 0 })).status).toBe(409);
    expect((await put(A, { answers: ["nope"], expectedVersion: 1 })).status).toBe(400);
  });

  it("coach reads (200) but cannot save (403); other club 403; anonymous 401", async () => {
    getCurrentUser.mockResolvedValue(bob);
    expect((await get(A)).status).toBe(200);
    expect((await put(A, { answers: [], expectedVersion: 0 })).status).toBe(403);
    getCurrentUser.mockResolvedValue(alice);
    expect((await get(B)).status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect((await get(A)).status).toBe(401);
  });
});
