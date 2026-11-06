import { describe, expect, it, vi } from "vitest";

import {
  fetchSportnetClubDirectory,
  fetchSportnetClubProfile,
  fetchSportnetLegalEntity,
} from "./ppo";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("fetchSportnetClubDirectory", () => {
  it("reads clubs and the union tree one after the other, without a token", async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) =>
      ok({ items: [{ _id: url.includes("related-ppos") ? "club" : "futbalsfz.sk" }] }),
    );
    const d = await fetchSportnetClubDirectory({ baseUrl: "https://api.test/v1", fetch });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "https://api.test/v1/ppo/futbalsfz.sk/related-ppos?ppoType=club",
      "https://api.test/v1/ppo/futbalsfz.sk/relations-structure",
    ]);
    expect(fetch.mock.calls[0]?.[1].headers).not.toHaveProperty("Authorization");
    expect(d).toEqual({ clubs: [{ _id: "club" }], tree: [{ _id: "futbalsfz.sk" }] });
  });

  it("throws on a Sportnet error", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 503 }));
    await expect(fetchSportnetClubDirectory({ fetch })).rejects.toThrow("responded with 503");
  });
});

describe("fetchSportnetLegalEntity", () => {
  it("keeps IČO, legal form and name – never contacts", async () => {
    const fetch = vi.fn(async () =>
      ok({
        name: " Mestský futbalový klub Nová Baňa ",
        business_id: "17067481",
        legal_form: "701",
        contact_person: "Osoba",
        email: "x@y.sk",
        phone: "+421",
      }),
    );
    expect(await fetchSportnetLegalEntity("mfk-nova-bana.futbalnet.sk", { fetch })).toEqual({
      legalName: "Mestský futbalový klub Nová Baňa",
      businessId: "17067481",
      legalForm: "701",
    });
  });
});

describe("fetchSportnetClubProfile", () => {
  it("returns only the relations of the public profile", async () => {
    const fetch = vi.fn(async () =>
      ok({ _id: "x", name: "X", relations: [{ related_ppo: "VsFZ", type: "matricity" }] }),
    );
    expect(await fetchSportnetClubProfile("x", { fetch })).toEqual({
      relations: [{ related_ppo: "VsFZ", type: "matricity" }],
    });
    const empty = vi.fn(async () => ok({ _id: "y" }));
    expect(await fetchSportnetClubProfile("y", { fetch: empty })).toEqual({ relations: [] });
  });
});
