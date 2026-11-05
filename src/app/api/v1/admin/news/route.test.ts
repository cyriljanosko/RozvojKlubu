import { beforeEach, describe, expect, it, vi } from "vitest";

import { A, B, admin, alice, bob, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryNewsStore, memoryRevisions } from "@/server/services/news.fixture";
import type { NewsDeps } from "@/server/services/news.service";

const getCurrentUser = vi.fn();
const holder: { deps: NewsDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get newsDeps() {
    return holder.deps;
  },
}));

const adminList = await import("./route");
const adminOne = await import("./[newsId]/route");
const returnRoute = await import("./[newsId]/return/route");
const publish = await import("./[newsId]/publish/route");
const pin = await import("./[newsId]/pin/route");
const clubList = await import("../../clubs/[clubId]/news/route");
const clubOne = await import("../../clubs/[clubId]/news/[newsId]/route");
const submit = await import("../../clubs/[clubId]/news/[newsId]/submit/route");
const publicList = await import("../../news/route");
const publicOne = await import("../../news/[slug]/route");

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const req = (method: string, body?: unknown, url = "http://localhost/api/v1/x") =>
  new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

const story = {
  kind: "story",
  title: "Turnaj prípraviek pre celú obec",
  areas: [6],
  sections: [
    { key: "start", text: "Na zápasy chodili len rodičia." },
    { key: "done", text: "Pozvali sme obec a školy." },
    { key: "result", text: "Prišlo 300 ľudí." },
    { key: "advice", text: "Spojte sa so školou." },
  ],
};

describe("/api/v1 news (ADR 0023)", () => {
  beforeEach(async () => {
    holder.deps = { ...memoryDeps(), news: memoryNewsStore(), revisions: memoryRevisions() };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(holder.deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    getCurrentUser.mockReset();
  });

  it("club proposes, SFZ returns and publishes, the public reads it", async () => {
    getCurrentUser.mockResolvedValue(alice);
    const created = await clubList.POST(req("POST", story), ctx({ clubId: A }));
    expect(created.status).toBe(201);
    const { data: draft } = await created.json();
    const sent = await submit.POST(
      req("POST", {
        expectedVersion: 1,
        consents: { publication: true, photoPeople: false, external: false },
      }),
      ctx({ clubId: A, newsId: draft.id }),
    );
    expect((await sent.json()).data.status).toBe("submitted");

    getCurrentUser.mockResolvedValue(admin);
    const { data: queue } = await (
      await adminList.GET(
        req("GET", undefined, "http://localhost/api/v1/admin/news?status=submitted"),
        ctx({}),
      )
    ).json();
    expect(queue).toMatchObject([{ id: draft.id, club: { clubId: A } }]);
    const returned = await returnRoute.POST(
      req("POST", { expectedVersion: 2, note: "Doplňte fotku." }),
      ctx({ newsId: draft.id }),
    );
    expect((await returned.json()).data).toMatchObject({ status: "returned" });

    getCurrentUser.mockResolvedValue(alice);
    await submit.POST(
      req("POST", {
        expectedVersion: 3,
        consents: { publication: true, photoPeople: false, external: false },
      }),
      ctx({ clubId: A, newsId: draft.id }),
    );

    getCurrentUser.mockResolvedValue(admin);
    const published = await publish.POST(
      req("POST", { expectedVersion: 4 }),
      ctx({ newsId: draft.id }),
    );
    const { data: post } = await published.json();
    expect(post).toMatchObject({ status: "published", slug: "turnaj-pripraviek-pre-celu-obec" });
    expect(
      (await pin.PUT(req("PUT", { expectedVersion: 5, pinned: true }), ctx({ newsId: draft.id })))
        .status,
    ).toBe(200);

    getCurrentUser.mockResolvedValue(null);
    const { data: page } = await (
      await publicList.GET(
        req("GET", undefined, "http://localhost/api/v1/news?kind=story"),
        ctx({}),
      )
    ).json();
    expect(page).toMatchObject({ pinned: { id: draft.id }, items: [], nextBefore: null });
    const detail = await publicOne.GET(req("GET"), ctx({ slug: post.slug }));
    expect((await detail.json()).data).toMatchObject({ title: story.title, club: { clubId: A } });
    expect((await publicOne.GET(req("GET"), ctx({ slug: "nope" }))).status).toBe(404);
  });

  it("authorization and tenant checks", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await clubList.GET(req("GET"), ctx({ clubId: A }))).status).toBe(401);
    expect((await adminList.GET(req("GET"), ctx({}))).status).toBe(401);

    getCurrentUser.mockResolvedValue(bob); // coach
    expect((await clubList.GET(req("GET"), ctx({ clubId: A }))).status).toBe(403);
    expect((await clubList.POST(req("POST", story), ctx({ clubId: A }))).status).toBe(403);

    getCurrentUser.mockResolvedValue(alice);
    expect((await clubList.POST(req("POST", story), ctx({ clubId: B }))).status).toBe(403);
    expect((await adminList.GET(req("GET"), ctx({}))).status).toBe(403);
    const { data: draft } = await (
      await clubList.POST(req("POST", story), ctx({ clubId: A }))
    ).json();
    expect((await clubOne.GET(req("GET"), ctx({ clubId: A, newsId: draft.id }))).status).toBe(200);
    expect(
      (await clubList.POST(req("POST", { ...story, kind: "academy" }), ctx({ clubId: A }))).status,
    ).toBe(400);

    getCurrentUser.mockResolvedValue(admin);
    // club drafts stay with the club
    expect((await adminOne.GET(req("GET"), ctx({ newsId: draft.id }))).status).toBe(404);
    expect((await clubOne.GET(req("GET"), ctx({ clubId: B, newsId: draft.id }))).status).toBe(404);
    const academy = await adminList.POST(
      req("POST", {
        title: "Nové sekcie v oblasti 1",
        areas: [1],
        sections: [{ key: "body", text: "Text." }],
      }),
      ctx({}),
    );
    expect(academy.status).toBe(201);
    expect((await academy.json()).data).toMatchObject({ kind: "academy", club: null });
  });
});
