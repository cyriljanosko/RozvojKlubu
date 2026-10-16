import { beforeEach, describe, expect, it, vi } from "vitest";

import { A, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryContentStore } from "@/server/services/content.fixture";
import { seedContent } from "@/server/services/content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "@/server/services/kompas.fixture";
import type { SubmissionDeps } from "@/server/services/kompas-submission.service";
import { saveKompasAnswers } from "@/server/services/kompas.service";

const getCurrentUser = vi.fn();
const holder: { deps: SubmissionDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get submissionDeps() {
    return holder.deps;
  },
}));

const list = await import("./route");
const one = await import("./[submissionId]/route");
const mentor = await import("../../../../mentor/clubs/route");
const p = <T>(x: T) => ({ params: Promise.resolve(x) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);

describe("Kompas submissions API", () => {
  beforeEach(async () => {
    const content = memoryContentStore();
    await seedContent(content, admin);
    holder.deps = {
      ...memoryDeps(),
      content,
      assessments: memoryAssessmentStore(),
      submissions: memorySubmissionStore(),
    };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "mentor" });
    await saveKompasAnswers(holder.deps, alice, A, { answers: ["3.i.1"], expectedVersion: 0 });
    getCurrentUser.mockReset();
  });

  it("management submits (201); mentor lists, opens and sees it in the overview", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await list.POST(
      req(`/api/v1/clubs/${A}/kompas/submissions`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      p({ clubId: A }),
    );
    expect(res.status).toBe(201);
    const { data: sub } = await res.json();

    getCurrentUser.mockResolvedValue(bob);
    expect(
      (
        await (
          await list.GET(req(`/api/v1/clubs/${A}/kompas/submissions`), p({ clubId: A }))
        ).json()
      ).data,
    ).toHaveLength(1);
    const detail = await one.GET(
      req(`/api/v1/clubs/${A}/kompas/submissions/${sub.id}`),
      p({ clubId: A, submissionId: sub.id }),
    );
    expect((await detail.json()).data.line).toMatch(/^SFZ-KOMPAS-1\|/);
    expect(
      (await (await mentor.GET(req("/api/v1/mentor/clubs"), {})).json()).data[0],
    ).toMatchObject({
      clubId: A,
    });
  });

  it("mentor cannot submit (403); anonymous 401; non-mentor overview 403", async () => {
    getCurrentUser.mockResolvedValue(bob);
    const res = await list.POST(
      req(`/api/v1/clubs/${A}/kompas/submissions`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      p({ clubId: A }),
    );
    expect(res.status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect(
      (await list.GET(req(`/api/v1/clubs/${A}/kompas/submissions`), p({ clubId: A }))).status,
    ).toBe(401);
    getCurrentUser.mockResolvedValue(alice);
    expect((await mentor.GET(req("/api/v1/mentor/clubs"), {})).status).toBe(403);
  });
});
