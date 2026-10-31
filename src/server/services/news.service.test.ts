import { beforeEach, describe, expect, it } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryNewsStore, memoryRevisions } from "./news.fixture";
import {
  awaitsClubConfirmation,
  createAcademyNews,
  createClubNews,
  excerptOf,
  getAdminNews,
  getClubNews,
  getPublishedNews,
  hideNews,
  listAdminNews,
  listClubNews,
  listPublishedNews,
  markNewsSharedWithComms,
  missingParts,
  publishNews,
  returnNewsToClub,
  setNewsExternalUrl,
  setNewsPinned,
  slugify,
  submitClubNews,
  updateAdminNews,
  updateClubNews,
  type NewsDeps,
} from "./news.service";
import type { CurrentUser } from "./users.service";

const carol: CurrentUser = { id: "carol", email: "carol@obfz.sk", name: "Carol", role: "public" };

const story = {
  kind: "story" as const,
  title: "Za rok päť nových trénerov z radov rodičov",
  areas: [3],
  sections: [
    { key: "start" as const, text: "Chýbali nám tréneri prípraviek. Dvaja odišli naraz." },
    { key: "done" as const, text: "Oslovili sme rodičov priamo na tréningu." },
    { key: "result" as const, text: "Päť nových trénerov s licenciou C." },
    { key: "advice" as const, text: "Začnite rozhovorom, nie letákom." },
  ],
};
const consents = { publication: true as const, photoPeople: false, external: true };

describe("pure helpers (ADR 0023)", () => {
  it("slug without diacritics, excerpt is the first sentence, missing parts per kind", () => {
    expect(slugify("Za rok päť nových trénerov!")).toBe("za-rok-pat-novych-trenerov");
    expect(slugify("???")).toBe("novinka");
    expect(excerptOf({ kind: "story", sections: story.sections })).toBe(
      "Chýbali nám tréneri prípraviek.",
    );
    expect(
      missingParts({ kind: "story", title: "Krátky", sections: story.sections.slice(0, 2) }),
    ).toEqual(["result", "advice"]);
    expect(
      excerptOf({
        kind: "academy",
        sections: [
          { key: "body", text: "Prihláste sa na [školenie UEFA A](https://futbalsfz.sk/x). Viac." },
        ],
      }),
    ).toBe("Prihláste sa na školenie UEFA A.");
    // bug 31. 10. 2026: a date cut the excerpt at "20."
    expect(
      excerptOf({
        kind: "academy",
        sections: [{ key: "body", text: "Školenie sa otvorí 20. 11. 2026. Prihláste trénerov." }],
      }),
    ).toBe("Školenie sa otvorí 20. 11. 2026.");
    expect(missingParts({ kind: "academy", title: "Nová oblasť", sections: [] })).toEqual(["body"]);
    const t = (s: string) => new Date(s);
    expect(awaitsClubConfirmation({ sfzEditedAt: null, submittedAt: t("2026-10-01") })).toBe(false);
    expect(
      awaitsClubConfirmation({ sfzEditedAt: t("2026-10-02"), submittedAt: t("2026-10-01") }),
    ).toBe(true);
    expect(
      awaitsClubConfirmation({ sfzEditedAt: t("2026-10-02"), submittedAt: t("2026-10-03") }),
    ).toBe(false);
  });
});

describe("news – club proposals and SFZ review (ADR 0023)", () => {
  let deps: NewsDeps & {
    news: ReturnType<typeof memoryNewsStore>;
    revisions: ReturnType<typeof memoryRevisions>;
  };
  beforeEach(async () => {
    const base = memoryDeps();
    deps = { ...base, news: memoryNewsStore(), revisions: memoryRevisions() };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    base.memberDocs.push({
      id: "mc",
      userId: "carol",
      clubId: A,
      role: "mentor",
      season: "2026/2027",
      ageGroups: [],
      createdBy: "admin",
      createdAt: new Date(),
    });
  });

  it("management drafts, edits and submits; the mentor reads; coaches and other clubs cannot", async () => {
    const draft = await createClubNews(deps, alice, A, {
      ...story,
      sections: story.sections.slice(0, 1),
    });
    expect(draft).toMatchObject({ status: "draft", version: 1, kind: "story", areas: [3] });
    expect(draft.sections.map((s) => s.key)).toEqual(["start", "done", "result", "advice"]);

    await expect(
      submitClubNews(deps, alice, A, draft.id, { expectedVersion: 1, consents }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      details: { missing: ["done", "result", "advice"] },
    });

    const edited = await updateClubNews(deps, alice, A, draft.id, { ...story, expectedVersion: 1 });
    expect(deps.revisions.docs).toEqual([]); // never submitted – no revision yet
    const sent = await submitClubNews(deps, alice, A, draft.id, {
      expectedVersion: edited.version,
      consents,
    });
    expect(sent).toMatchObject({
      status: "submitted",
      consents: { publication: true, photoPeople: false, external: true },
    });
    await expect(
      updateClubNews(deps, alice, A, draft.id, { ...story, expectedVersion: sent.version }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await listClubNews(deps, carol, A)).toMatchObject({
      canEdit: false,
      items: [{ id: draft.id }],
    });
    expect((await getClubNews(deps, carol, A, draft.id)).status).toBe("submitted");
    await expect(listClubNews(deps, bob, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createClubNews(deps, carol, A, story)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createClubNews(deps, alice, B, story)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createClubNews(deps, admin, A, story)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listClubNews(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    // tenant: the post of club A is not found under club B even for admin_sfz
    await expect(getClubNews(deps, admin, B, draft.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // at most three areas
    await expect(
      createClubNews(deps, alice, A, { ...story, areas: [1, 2, 3, 4] }),
    ).rejects.toThrow();
  });

  it("SFZ returns with a note, edits need the club's confirmation, then publishes", async () => {
    const draft = await createClubNews(deps, alice, A, story);
    const sent = await submitClubNews(deps, alice, A, draft.id, { expectedVersion: 1, consents });

    // the admin does not see club drafts, only submitted posts
    const other = await createClubNews(deps, alice, A, story);
    expect((await listAdminNews(deps, admin, {})).map((p) => p.id)).toEqual([draft.id]);
    await expect(getAdminNews(deps, admin, other.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listAdminNews(deps, alice, {})).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      returnNewsToClub(deps, admin, draft.id, { expectedVersion: sent.version, note: "" }),
    ).rejects.toThrow();
    const returned = await returnNewsToClub(deps, admin, draft.id, {
      expectedVersion: sent.version,
      note: "Doplňte prosím čísla.",
    });
    expect(returned).toMatchObject({ status: "returned", reviewNote: "Doplňte prosím čísla." });
    expect((await listClubNews(deps, alice, A)).items.find((i) => i.id === draft.id)).toMatchObject(
      {
        reviewNote: "Doplňte prosím čísla.",
      },
    );

    const resent = await submitClubNews(deps, alice, A, draft.id, {
      expectedVersion: returned.version,
      consents,
    });
    expect(resent.reviewNote).toBeNull();

    // SFZ edits the text → the club must confirm before publishing
    deps.now = () => new Date("2026-10-17T12:00:00Z");
    const edited = await updateAdminNews(deps, admin, draft.id, {
      ...story,
      title: "Päť nových trénerov z radov rodičov",
      expectedVersion: resent.version,
    });
    expect(edited.awaitsConfirmation).toBe(true);
    expect(deps.revisions.docs).toMatchObject([{ entity: "news_post", entityId: draft.id }]);
    await expect(
      publishNews(deps, admin, draft.id, { expectedVersion: edited.version }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const back = await returnNewsToClub(deps, admin, draft.id, {
      expectedVersion: edited.version,
      note: "Upravili sme nadpis, potvrďte prosím.",
    });
    deps.now = () => new Date("2026-10-18T12:00:00Z");
    const confirmed = await submitClubNews(deps, alice, A, draft.id, {
      expectedVersion: back.version,
      consents,
    });
    expect(confirmed.awaitsConfirmation).toBe(false);

    const published = await publishNews(deps, admin, draft.id, {
      expectedVersion: confirmed.version,
    });
    expect(published).toMatchObject({
      status: "published",
      slug: "pat-novych-trenerov-z-radov-rodicov",
      publishedAt: "2026-10-18T12:00:00.000Z",
    });
  });

  it("academy news, the public list and detail, pinning, sharing and hiding", async () => {
    await expect(
      createAcademyNews(deps, alice, { title: "X", areas: [], sections: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const academy = await createAcademyNews(deps, admin, {
      title: "Oblasť 1 Vedenie má nové sekcie",
      areas: [1],
      sections: [{ key: "body", text: "Pribudli tri sekcie. Pozrite si ich." }],
    });
    const pubA = await publishNews(deps, admin, academy.id, { expectedVersion: 1 });

    deps.now = () => new Date("2026-10-17T12:00:00Z");
    const club = await createClubNews(deps, alice, A, { ...story, areas: [1, 3] });
    const sent = await submitClubNews(deps, alice, A, club.id, {
      expectedVersion: 1,
      consents: { ...consents, external: false },
    });
    const pubC = await publishNews(deps, admin, club.id, { expectedVersion: sent.version });

    // same title again → unique slug
    deps.now = () => new Date("2026-10-18T12:00:00Z");
    const twin = await createAcademyNews(deps, admin, {
      title: "Oblasť 1 Vedenie má nové sekcie",
      areas: [],
      sections: [{ key: "body", text: "Druhý text." }],
    });
    const pubT = await publishNews(deps, admin, twin.id, { expectedVersion: 1 });
    expect(pubT.slug).toBe("oblast-1-vedenie-ma-nove-sekcie-2");

    const page = await listPublishedNews(deps, { limit: 2 });
    expect(page.pinned).toBeNull();
    expect(page.items.map((i) => i.id)).toEqual([twin.id, club.id]);
    expect(page.items[1]).toMatchObject({
      club: { clubId: A },
      excerpt: "Chýbali nám tréneri prípraviek.",
    });
    const next = await listPublishedNews(deps, { limit: 2, before: page.nextBefore });
    expect(next).toMatchObject({ items: [{ id: academy.id }], nextBefore: null });
    expect((await listPublishedNews(deps, { kind: "story" })).items.map((i) => i.id)).toEqual([
      club.id,
    ]);
    expect((await listPublishedNews(deps, { area: 3 })).items.map((i) => i.id)).toEqual([club.id]);

    const pinned = await setNewsPinned(deps, admin, academy.id, {
      expectedVersion: pubA.version,
      pinned: true,
    });
    expect(pinned.pinned).toBe(true);
    const withPin = await listPublishedNews(deps, {});
    expect(withPin.pinned?.id).toBe(academy.id);
    expect(withPin.items.map((i) => i.id)).toEqual([twin.id, club.id]);
    // pinning another unpins the first
    await setNewsPinned(deps, admin, club.id, { expectedVersion: pubC.version, pinned: true });
    expect((await listPublishedNews(deps, {})).pinned?.id).toBe(club.id);

    const detail = await getPublishedNews(deps, pubC.slug!, { countView: true });
    expect(detail).toMatchObject({ title: story.title, editedBySfz: false, club: { clubId: A } });
    expect(detail.related.map((r) => r.id)).toEqual([academy.id, twin.id]);
    expect((await getAdminNews(deps, admin, club.id)).views).toBe(1);
    await expect(getPublishedNews(deps, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });

    // sharing outside the Academy only with the club's consent
    const current = await getAdminNews(deps, admin, club.id);
    await expect(
      markNewsSharedWithComms(deps, admin, club.id, { expectedVersion: current.version }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const shared = await markNewsSharedWithComms(deps, admin, academy.id, {
      expectedVersion: (await getAdminNews(deps, admin, academy.id)).version,
    });
    expect(shared.commsSharedAt).not.toBeNull();
    await expect(
      setNewsExternalUrl(deps, admin, academy.id, {
        expectedVersion: shared.version,
        url: "https://example.com/a",
      }),
    ).rejects.toThrow();
    const linked = await setNewsExternalUrl(deps, admin, academy.id, {
      expectedVersion: shared.version,
      url: "https://www.futbalsfz.sk/clanok/novinky",
    });
    expect(linked.externalUrl).toBe("https://www.futbalsfz.sk/clanok/novinky");

    // hiding takes it off the public list and unpins it; it can be published again
    const hidden = await hideNews(deps, admin, club.id, { expectedVersion: current.version });
    expect(hidden).toMatchObject({ status: "hidden", pinned: false });
    await expect(getPublishedNews(deps, pubC.slug!)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const again = await publishNews(deps, admin, club.id, { expectedVersion: hidden.version });
    expect(again).toMatchObject({ slug: pubC.slug, publishedAt: pubC.publishedAt });

    // stale version → conflict
    await expect(
      hideNews(deps, admin, club.id, { expectedVersion: hidden.version }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
