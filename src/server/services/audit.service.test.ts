import { afterEach, describe, expect, it, vi } from "vitest";

import { memoryAudit } from "./audit.fixture";
import {
  listAuditLog,
  recordAudit,
  type AuditReader,
  type StoredAuditEntry,
} from "./audit.service";
import { admin, alice } from "./clubs.fixture";

const at = new Date("2026-11-07T10:00:00Z");

describe("recordAudit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stores the actor, its role and the change", async () => {
    const audit = memoryAudit();
    await recordAudit({ audit }, admin, {
      action: "club.member.add",
      clubId: "club-a",
      target: { type: "membership", id: "m1" },
      changes: { role: { to: "coach" } },
      at,
    });
    expect(audit.entries).toEqual([
      {
        at,
        actorId: admin.id,
        actorRole: "admin_sfz",
        source: "user",
        action: "club.member.add",
        clubId: "club-a",
        target: { type: "membership", id: "m1" },
        changes: { role: { to: "coach" } },
      },
    ]);
  });

  it("marks a run without a user as cron and keeps the given source", async () => {
    const audit = memoryAudit();
    await recordAudit({ audit }, null, {
      action: "sportnet.sync.apply",
      clubId: null,
      target: { type: "sync_run", id: "sportnet-clubs" },
    });
    await recordAudit(
      { audit },
      { id: "u1" },
      {
        action: "club.member.sportnet",
        source: "sportnet",
        clubId: "club-a",
        target: { type: "user", id: "u1" },
      },
    );
    expect(audit.entries.map((e) => [e.source, e.actorId, e.actorRole])).toEqual([
      ["cron", null, null],
      ["sportnet", "u1", null],
    ]);
  });

  it("never throws when the write fails – the change stays valid", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const audit = { record: vi.fn(async () => Promise.reject(new Error("db down"))) };
    await expect(
      recordAudit({ audit }, admin, {
        action: "news.hide",
        clubId: null,
        target: { type: "news", id: "n1" },
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("[audit] write failed – news.hide news – db down");
  });
});

describe("listAuditLog", () => {
  const stored: StoredAuditEntry = {
    id: "a1",
    at,
    actorId: alice.id,
    actorRole: "public",
    source: "user",
    action: "club.rankingConsent.set",
    clubId: "club-a",
    target: { type: "club_settings", id: "club-a" },
  };
  const reader = (entries: StoredAuditEntry[], total = entries.length) => {
    const list = vi.fn<AuditReader["list"]>(async () => ({ entries, total }));
    return { list };
  };
  const users = {
    findById: async (id: string) => (id === alice.id ? alice : null),
  };

  it("is only for admin_sfz", async () => {
    const audit = reader([]);
    await expect(listAuditLog({ audit, users }, null, {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(listAuditLog({ audit, users }, alice, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(audit.list).not.toHaveBeenCalled();
  });

  it("passes the filter, pages by 50 and includes the whole last day", async () => {
    const audit = reader([], 120);
    const result = await listAuditLog({ audit, users }, admin, {
      clubId: "club-a",
      action: "news.publish",
      from: "2026-11-01",
      to: "2026-11-07",
      page: "3",
    });
    expect(audit.list).toHaveBeenCalledWith(
      {
        clubId: "club-a",
        action: "news.publish",
        from: new Date("2026-11-01T00:00:00Z"),
        to: new Date("2026-11-08T00:00:00Z"),
      },
      { skip: 100, limit: 50 },
    );
    expect(result.page).toEqual({ page: 3, pageSize: 50, total: 120, pages: 3 });
  });

  it("resolves names when reading; a removed account shows an empty name", async () => {
    const gone = { ...stored, id: "a2", actorId: "deleted-user" };
    const cron = { ...stored, id: "a3", actorId: null, actorRole: null, source: "cron" as const };
    const result = await listAuditLog({ audit: reader([stored, gone, cron]), users }, admin, {});
    expect(result.entries.map((e) => e.actorName)).toEqual([alice.name, "", null]);
    expect(result.entries[0]).toMatchObject({ at: at.toISOString(), changes: {} });
  });

  it("rejects an unknown action or date", async () => {
    const audit = reader([]);
    await expect(listAuditLog({ audit, users }, admin, { action: "x" })).rejects.toThrow();
    await expect(listAuditLog({ audit, users }, admin, { from: "7. 11." })).rejects.toThrow();
  });
});
