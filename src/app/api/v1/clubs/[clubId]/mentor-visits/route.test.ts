import { beforeEach, describe, expect, it, vi } from "vitest";

import { A, B, admin, alice, memoryDeps } from "@/server/services/clubs.fixture";
import { addClubMember } from "@/server/services/clubs.service";
import { memoryVisitStore } from "@/server/services/mentor-visit.fixture";
import type { MentorVisitDeps } from "@/server/services/mentor-visit.service";

const getCurrentUser = vi.fn();
const holder: { deps: MentorVisitDeps | null } = { deps: null };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/clubs/deps", () => ({
  get visitDeps() {
    return holder.deps;
  },
}));

const list = await import("./route");
const one = await import("./[visitId]/route");
const send = await import("./[visitId]/send/route");
const withdraw = await import("./[visitId]/withdraw/route");
const action = await import("./[visitId]/actions/[actionId]/route");

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/v1/x", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const visit = {
  date: "2026-10-15",
  form: "onsite",
  participants: "Alice",
  summary: "Stretnutie s výborom.",
  findings: [],
  actions: [{ text: "Vyplniť Kompas", area: null, owner: "Alice", dueDate: "2026-11-01" }],
};

describe("/api/v1/clubs/:clubId/mentor-visits", () => {
  beforeEach(async () => {
    holder.deps = { ...memoryDeps(), visits: memoryVisitStore() };
    await addClubMember(holder.deps, admin, A, { email: "alice@klub.sk", role: "management" });
    getCurrentUser.mockReset();
  });

  it("admin records and sends a visit; management sees it and ticks the action", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const created = await list.POST(req("POST", visit), ctx({ clubId: A }));
    expect(created.status).toBe(201);
    const { data: v } = await created.json();
    expect(v).toMatchObject({ status: "draft", version: 1 });
    expect(
      (await send.POST(req("POST", { expectedVersion: 1 }), ctx({ clubId: A, visitId: v.id })))
        .status,
    ).toBe(200);

    getCurrentUser.mockResolvedValue(alice);
    const { data: listed } = await (await list.GET(req("GET"), ctx({ clubId: A }))).json();
    expect(listed).toMatchObject({ access: "club", visits: [{ id: v.id, status: "sent" }] });
    const ticked = await action.PATCH(
      req("PATCH", { done: true, expectedVersion: 2 }),
      ctx({ clubId: A, visitId: v.id, actionId: v.actions[0].id }),
    );
    expect((await ticked.json()).data.actions[0].done).toBe(true);
    // the club cannot edit or withdraw
    expect(
      (
        await one.PATCH(
          req("PATCH", { ...visit, expectedVersion: 3 }),
          ctx({ clubId: A, visitId: v.id }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await withdraw.POST(req("POST", { expectedVersion: 3 }), ctx({ clubId: A, visitId: v.id })))
        .status,
    ).toBe(403);
  });

  it("refuses the club to record (403), other clubs (403), anonymous (401) and bad input (400)", async () => {
    getCurrentUser.mockResolvedValue(alice);
    expect((await list.POST(req("POST", visit), ctx({ clubId: A }))).status).toBe(403);
    expect((await list.GET(req("GET"), ctx({ clubId: B }))).status).toBe(403);
    getCurrentUser.mockResolvedValue(null);
    expect((await list.GET(req("GET"), ctx({ clubId: A }))).status).toBe(401);
    getCurrentUser.mockResolvedValue(admin);
    expect(
      (await list.POST(req("POST", { ...visit, form: "fax" }), ctx({ clubId: A }))).status,
    ).toBe(400);
    expect((await one.GET(req("GET"), ctx({ clubId: A, visitId: "nope" }))).status).toBe(404);
  });
});
