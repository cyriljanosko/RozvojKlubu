import { beforeEach, describe, expect, it, vi } from "vitest";

import { A, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import {
  memoryEvaluationStore,
  memoryLicensingSubmissionStore,
} from "@/server/services/licensing.fixture";
import type { LicensingDeps } from "@/server/services/licensing.service";

const getCurrentUser = vi.fn();
const holder: { deps: LicensingDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get licensingDeps() {
    return holder.deps;
  },
}));

const evaluation = await import("./route");
const submissions = await import("./submissions/route");
const reopen = await import("./reopen/route");
const p = <T>(x: T) => ({ params: Promise.resolve(x) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const inputs = {
  population: 3000,
  infrastructure: { turf_small: 2 },
  activities: {},
  cooperation: {},
  coachGender: {},
};

describe("licensing API", () => {
  beforeEach(async () => {
    holder.deps = {
      ...memoryDeps(),
      evaluations: memoryEvaluationStore(),
      licensingSubmissions: memoryLicensingSubmissionStore(),
    };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    getCurrentUser.mockReset();
  });

  it("management saves and closes a season; the coach reads the frozen copy", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const put = await evaluation.PUT(
      req(`/api/v1/clubs/${A}/licensing`, {
        method: "PUT",
        body: JSON.stringify({ season: "2026/2027", inputs, expectedVersion: 0 }),
      }),
      p({ clubId: A }),
    );
    expect(put.status).toBe(200);
    const { data: saved } = await put.json();
    expect(saved).toMatchObject({ version: 1, result: { coefficient: 1.4 } });

    const close = await submissions.POST(
      req(`/api/v1/clubs/${A}/licensing/submissions`, {
        method: "POST",
        body: JSON.stringify({ season: "2026/2027", expectedVersion: 1 }),
      }),
      p({ clubId: A }),
    );
    expect(close.status).toBe(201);

    getCurrentUser.mockResolvedValue(bob);
    const get = await evaluation.GET(
      req(`/api/v1/clubs/${A}/licensing?season=2026-2027`),
      p({ clubId: A }),
    );
    const { data: view } = await get.json();
    expect(view).toMatchObject({
      access: "read",
      season: "2026/2027",
      closed: { season: "2026/2027" },
    });
    expect(view.result.areas[3]).toMatchObject({ area: 5, points: 10 });
  });

  it("rejects the coach's write (403), anonymous (401), a bad season (400) and malformed JSON (400)", async () => {
    getCurrentUser.mockResolvedValue(bob);
    const put = await evaluation.PUT(
      req(`/api/v1/clubs/${A}/licensing`, {
        method: "PUT",
        body: JSON.stringify({ season: "2026/2027", inputs, expectedVersion: 0 }),
      }),
      p({ clubId: A }),
    );
    expect(put.status).toBe(403);

    getCurrentUser.mockResolvedValue(null);
    expect(
      (await evaluation.GET(req(`/api/v1/clubs/${A}/licensing`), p({ clubId: A }))).status,
    ).toBe(401);

    getCurrentUser.mockResolvedValue(alice);
    const bad = await evaluation.GET(
      req(`/api/v1/clubs/${A}/licensing?season=2026`),
      p({ clubId: A }),
    );
    expect(bad.status).toBe(400);
    const malformed = await evaluation.PUT(
      req(`/api/v1/clubs/${A}/licensing`, { method: "PUT", body: "{" }),
      p({ clubId: A }),
    );
    expect(malformed.status).toBe(400);
  });

  it("lets admin reopen a closed season (200) and refuses management (403)", async () => {
    getCurrentUser.mockResolvedValue(alice);
    await evaluation.PUT(
      req(`/api/v1/clubs/${A}/licensing`, {
        method: "PUT",
        body: JSON.stringify({ season: "2026/2027", inputs, expectedVersion: 0 }),
      }),
      p({ clubId: A }),
    );
    await submissions.POST(
      req(`/api/v1/clubs/${A}/licensing/submissions`, {
        method: "POST",
        body: JSON.stringify({ season: "2026/2027", expectedVersion: 1 }),
      }),
      p({ clubId: A }),
    );
    const body = JSON.stringify({ season: "2026/2027" });
    const denied = await reopen.POST(
      req(`/api/v1/clubs/${A}/licensing/reopen`, { method: "POST", body }),
      p({ clubId: A }),
    );
    expect(denied.status).toBe(403);

    getCurrentUser.mockResolvedValue(admin);
    const res = await reopen.POST(
      req(`/api/v1/clubs/${A}/licensing/reopen`, { method: "POST", body }),
      p({ clubId: A }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.reopenedAt).toBeTruthy();
    const again = await reopen.POST(
      req(`/api/v1/clubs/${A}/licensing/reopen`, { method: "POST", body }),
      p({ clubId: A }),
    );
    expect(again.status).toBe(409);
  });
});
