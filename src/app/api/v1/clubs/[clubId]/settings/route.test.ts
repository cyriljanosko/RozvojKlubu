import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryClubSettingsStore } from "@/server/services/club-settings.fixture";
import type { ClubSettingsDeps } from "@/server/services/club-settings.service";
import { A, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";

const getCurrentUser = vi.fn();
const holder: { deps: ClubSettingsDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get settingsDeps() {
    return holder.deps;
  },
}));

const settings = await import("./route");
const consent = await import("./ranking-consent/route");
const p = <T>(x: T) => ({ params: Promise.resolve(x) }) as never;
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const put = (body: unknown) =>
  consent.PUT(
    req(`/api/v1/clubs/${A}/settings/ranking-consent`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    p({ clubId: A }),
  );

describe("club settings API (MR-a)", () => {
  beforeEach(async () => {
    holder.deps = { ...memoryDeps(), settings: memoryClubSettingsStore() };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    getCurrentUser.mockReset();
  });

  it("management gives the consent; everyone in the club reads it", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const res = await put({ given: true, expectedVersion: 0 });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ rankingConsent: { given: true }, version: 1 });

    getCurrentUser.mockResolvedValue(bob);
    const read = await settings.GET(req(`/api/v1/clubs/${A}/settings`), p({ clubId: A }));
    expect((await read.json()).data).toMatchObject({
      rankingConsent: { given: true },
      canEdit: false,
    });
  });

  it("admin_sfz changes the consent for the club (ADR 0020)", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await put({ given: true, expectedVersion: 0 });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({
      rankingConsent: { given: true },
      canEdit: true,
    });
  });

  it("refuses coaches, anonymous users and bad input", async () => {
    getCurrentUser.mockResolvedValue(bob);
    expect((await put({ given: true, expectedVersion: 0 })).status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect((await put({ given: true, expectedVersion: 0 })).status).toBe(401);
    getCurrentUser.mockResolvedValue(alice);
    expect((await put({ given: 1 })).status).toBe(400);
  });
});
