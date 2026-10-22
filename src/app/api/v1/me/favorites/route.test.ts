import { beforeEach, describe, expect, it, vi } from "vitest";

import { alice, bob } from "@/server/services/clubs.fixture";
import { memoryPreferencesStore } from "@/server/services/preferences.fixture";
import type { PreferencesDeps } from "@/server/services/preferences.service";

const getCurrentUser = vi.fn();
const holder: { deps: PreferencesDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get preferencesDeps() {
    return holder.deps;
  },
}));

const favorites = await import("./route");
const preferences = await import("../preferences/route");
const url = "http://localhost/api/v1/me/favorites";
const json = (method: string, body: unknown, target = url) =>
  new Request(target, { method, body: JSON.stringify(body) });

describe("/api/v1/me/favorites and /preferences", () => {
  beforeEach(() => {
    holder.deps = { preferences: memoryPreferencesStore() };
    getCurrentUser.mockReset();
  });

  it("pins, reads, saves the dashboard and unpins – each user only their own", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const added = await favorites.POST(
      json("POST", { kind: "area", href: "/oblasti/3", label: "Tréneri" }),
      {} as never,
    );
    expect(added.status).toBe(201);
    const { data } = await (await preferences.GET(new Request(url), {} as never)).json();
    expect(data.favorites).toHaveLength(1);
    const put = await preferences.PUT(
      json("PUT", { dashboard: { order: ["favorites"], hidden: [] }, expectedVersion: 1 }),
      {} as never,
    );
    expect((await put.json()).data.version).toBe(2);
    getCurrentUser.mockResolvedValue(bob);
    expect(
      (await (await preferences.GET(new Request(url), {} as never)).json()).data.favorites,
    ).toHaveLength(0);
    getCurrentUser.mockResolvedValue(alice);
    const del = await favorites.DELETE(
      new Request(`${url}?href=${encodeURIComponent("/oblasti/3")}`, { method: "DELETE" }),
      {} as never,
    );
    expect((await del.json()).data.favorites).toHaveLength(0);
  });

  it("refuses anonymous (401), external links (400) and stale versions (409)", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await preferences.GET(new Request(url), {} as never)).status).toBe(401);
    getCurrentUser.mockResolvedValue(alice);
    expect(
      (
        await favorites.POST(
          json("POST", { kind: "area", href: "https://zly.sk", label: "x" }),
          {} as never,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await preferences.PUT(
          json("PUT", { dashboard: { order: [], hidden: [] }, expectedVersion: 5 }),
          {} as never,
        )
      ).status,
    ).toBe(409);
  });
});
