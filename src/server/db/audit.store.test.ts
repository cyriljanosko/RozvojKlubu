import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/mongo", () => ({ getDb: vi.fn() }));

const { auditMongoFilter, AUDIT_RETENTION_SECONDS } = await import("./audit.store");

describe("auditMongoFilter", () => {
  it("is empty without a filter", () => {
    expect(auditMongoFilter({})).toEqual({});
  });

  it("filters by club, actor, action and a half-open time range", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-08T00:00:00Z");
    expect(
      auditMongoFilter({ clubId: "club-a", actorId: "u1", action: "news.hide", from, to }),
    ).toEqual({
      clubId: "club-a",
      actorId: "u1",
      action: "news.hide",
      at: { $gte: from, $lt: to },
    });
  });
});

describe("retention", () => {
  it("keeps entries for 3 years", () => {
    expect(AUDIT_RETENTION_SECONDS).toBe(94_608_000);
  });
});
