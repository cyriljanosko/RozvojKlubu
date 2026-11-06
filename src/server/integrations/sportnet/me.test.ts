import { describe, expect, it, vi } from "vitest";

import { affiliationsOf, fetchMyAffiliations } from "./me";

describe("affiliationsOf", () => {
  // The wrapper key of /me/sport-orgs is not documented; accept a bare array or the first array.
  it("reads a bare array or the first array property", () => {
    expect(affiliationsOf([{ _id: "1" }])).toEqual([{ _id: "1" }]);
    expect(affiliationsOf({ total: 1, sportorgs: [{ _id: "2" }] })).toEqual([{ _id: "2" }]);
  });

  it("returns an empty list for anything else", () => {
    expect(affiliationsOf(null)).toEqual([]);
    expect(affiliationsOf({ total: 0 })).toEqual([]);
  });
});

describe("fetchMyAffiliations", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("calls both /me endpoints one after another with the user's token", async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) =>
      ok(url.endsWith("/me/sport-orgs") ? [{ _id: "p" }] : { items: [{ _id: "e" }] }),
    );
    const result = await fetchMyAffiliations("tok", { baseUrl: "https://api.test/v1/", fetch });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "https://api.test/v1/me/sport-orgs",
      "https://api.test/v1/me/sport-expert-orgs",
    ]);
    expect(fetch.mock.calls[0]?.[1].headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(result).toEqual({ sportOrgs: [{ _id: "p" }], sportExpertOrgs: [{ _id: "e" }] });
  });

  it("throws on a Sportnet error", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 401 }));
    await expect(fetchMyAffiliations("tok", { fetch })).rejects.toThrow(
      "/me/sport-orgs responded with 401",
    );
  });
});
