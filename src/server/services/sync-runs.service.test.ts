import { describe, expect, it, vi } from "vitest";

import { admin, alice } from "./clubs.fixture";
import type { ClubImportDeps } from "./club-import.service";
import {
  getSportnetSyncStatus,
  runRecordedClubSync,
  startManualClubSync,
  type SyncRun,
  type SyncRunDeps,
} from "./sync-runs.service";

const t0 = new Date("2026-11-07T02:00:00Z");

function deps(overrides: Partial<ClubImportDeps> = {}) {
  const runs: SyncRun[] = [];
  let tick = 0;
  const clubs: ClubImportDeps = {
    store: {
      listClubsForImport: vi.fn(async () => []),
      applyClubImport: vi.fn(async () => {}),
      listClubsWithoutDetails: vi.fn(async () => []),
      countClubsWithoutDetails: vi.fn(async () => 0),
      listClubsForRefresh: vi.fn(async () => []),
      setClubDetails: vi.fn(async () => {}),
    },
    fetchDirectory: vi.fn(async () => ({ clubs: [], tree: [] })),
    fetchProfile: vi.fn(async () => ({ relations: [] })),
    fetchLegalEntity: vi.fn(async () => ({})),
    // each call one second later, so the run has a duration
    now: () => new Date(t0.getTime() + 1000 * tick++),
    ...overrides,
  };
  const d: SyncRunDeps & { saved: SyncRun[] } = {
    clubs,
    saved: runs,
    runs: {
      insertRun: vi.fn(async (run: SyncRun) => {
        runs.unshift(run);
      }),
      listRuns: vi.fn(async (_kind: SyncRun["kind"], limit: number) => runs.slice(0, limit)),
    },
    stats: async () => ({ activeClubs: 1558, withoutDetails: 0, oldestDetailsAt: t0 }),
    users: {
      findById: vi.fn(async (id: string) => (id === admin.id ? admin : null)),
    },
  };
  return d;
}

describe("runRecordedClubSync", () => {
  it("records a successful run with its counts only", async () => {
    const d = deps();
    const result = await runRecordedClubSync(d, "cron");
    expect(d.saved).toHaveLength(1);
    expect(d.saved[0]).toMatchObject({
      kind: "sportnet-clubs",
      trigger: "cron",
      ok: true,
      error: null,
      actorId: null,
      result,
    });
    expect(d.saved[0].finishedAt.getTime()).toBeGreaterThan(d.saved[0].startedAt.getTime());
  });

  it("records a failed run and throws the error again", async () => {
    const d = deps({
      fetchDirectory: vi.fn(async () => {
        throw new Error("Sportnet 503 ".repeat(40));
      }),
    });
    await expect(runRecordedClubSync(d, "cron")).rejects.toThrow("Sportnet 503");
    expect(d.saved[0]).toMatchObject({ ok: false, result: null });
    expect(d.saved[0].error).toHaveLength(200);
  });
});

describe("startManualClubSync", () => {
  it("dry-run by default: reads Sportnet, writes and records nothing", async () => {
    const d = deps();
    expect(await startManualClubSync(d, admin, {})).toMatchObject({ applied: false });
    expect(d.clubs.fetchDirectory).toHaveBeenCalledOnce();
    expect(d.clubs.store.applyClubImport).not.toHaveBeenCalled();
    expect(d.runs.insertRun).not.toHaveBeenCalled();
  });

  it("apply: writes and records the run with the admin", async () => {
    const d = deps();
    expect(await startManualClubSync(d, admin, { apply: true })).toMatchObject({ applied: true });
    expect(d.clubs.store.applyClubImport).toHaveBeenCalledOnce();
    expect(d.saved[0]).toMatchObject({ trigger: "manual", actorId: "admin", ok: true });
  });

  it("only admin_sfz, and only a signed-in user", async () => {
    const d = deps();
    await expect(startManualClubSync(d, alice, { apply: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(startManualClubSync(d, null, {})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(d.clubs.fetchDirectory).not.toHaveBeenCalled();
  });
});

describe("getSportnetSyncStatus", () => {
  it("returns club counts and the last runs with who started a manual one (ADR 0031)", async () => {
    const d = deps();
    await startManualClubSync(d, admin, { apply: true });
    const status = await getSportnetSyncStatus(d, admin);
    expect(status.clubs).toEqual({
      activeClubs: 1558,
      withoutDetails: 0,
      oldestDetailsAt: t0.toISOString(),
    });
    expect(status.runs).toHaveLength(1);
    expect(status.runs[0]).toMatchObject({ trigger: "manual", ok: true });
    expect(status.runs[0].durationMs).toBeGreaterThan(0);
    expect(status.runs[0].actorName).toBe(admin.name);
    expect(status.runs[0]).not.toHaveProperty("actorId");
    expect(d.runs.listRuns).toHaveBeenCalledWith("sportnet-clubs", 20);
  });

  it("shows no name for the nightly run and a placeholder for a deleted account", async () => {
    const d = deps();
    await runRecordedClubSync(d, "cron");
    await runRecordedClubSync(d, "manual", "gone");
    const { runs } = await getSportnetSyncStatus(d, admin);
    expect(runs.map((r) => r.actorName)).toEqual(["", null]);
    expect(d.users.findById).toHaveBeenCalledTimes(1);
  });

  it("only admin_sfz", async () => {
    await expect(getSportnetSyncStatus(deps(), alice)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
