import { z } from "zod";

import type { SyncRunDoc } from "@/server/db/types";
import { recordAudit, type AuditDeps } from "@/server/services/audit.service";
import { requireAdmin } from "@/server/services/club-access";
import {
  syncSportnetClubs,
  type ClubImportDeps,
  type ClubSyncResult,
} from "@/server/services/club-import.service";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Record of the writing Sportnet sync runs (ADR 0030): the nightly cron and the manual run of
 * admin_sfz write one document per run – counts only, no clubs or people. A dry-run is not
 * recorded. Pure orchestration; storage is injected.
 */

export type SyncRun = Omit<SyncRunDoc, "_id">;

export interface SyncRunStore {
  insertRun: (run: SyncRun) => Promise<void>;
  /** newest first */
  listRuns: (kind: SyncRun["kind"], limit: number) => Promise<SyncRun[]>;
}

export interface ClubSyncStats {
  activeClubs: number;
  withoutDetails: number;
  oldestDetailsAt: Date | null;
}

export interface SyncRunDeps extends AuditDeps {
  clubs: ClubImportDeps;
  runs: SyncRunStore;
  stats: () => Promise<ClubSyncStats>;
}

const ERROR_MAX = 200;

/** Runs the club sync and records it, also when it fails (the error is thrown again). */
export async function runRecordedClubSync(
  deps: SyncRunDeps,
  trigger: SyncRun["trigger"],
  actorId: string | null = null,
): Promise<ClubSyncResult> {
  const now = () => deps.clubs.now?.() ?? new Date();
  const startedAt = now();
  const record = (run: Pick<SyncRun, "ok" | "result" | "error">) =>
    deps.runs.insertRun({
      kind: "sportnet-clubs",
      trigger,
      startedAt,
      finishedAt: now(),
      actorId,
      ...run,
    });
  let result: ClubSyncResult;
  try {
    result = await syncSportnetClubs(deps.clubs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await record({ ok: false, result: null, error: message.slice(0, ERROR_MAX) });
    throw error;
  }
  await record({ ok: true, result: { ...result }, error: null });
  return result;
}

export const manualSyncInputSchema = z.object({ apply: z.boolean().default(false) });

export type ManualSyncResult = ClubSyncResult & { applied: boolean };

/** Manual run of the nightly sync (admin_sfz); dry-run unless `apply: true`, which is recorded. */
export async function startManualClubSync(
  deps: SyncRunDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<ManualSyncResult> {
  const user = requireUser(actor);
  requireAdmin(user);
  const { apply } = manualSyncInputSchema.parse(input ?? {});
  if (!apply) return { applied: false, ...(await syncSportnetClubs(deps.clubs, { apply: false })) };
  const result = await runRecordedClubSync(deps, "manual", user.id);
  await recordAudit(deps, user, {
    action: "sportnet.sync.apply",
    clubId: null,
    target: { type: "sync_run", id: "sportnet-clubs" },
    changes: { created: { to: result.created }, updated: { to: result.updated } },
  });
  return { applied: true, ...result };
}

export interface SyncRunView {
  trigger: SyncRun["trigger"];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  result: Record<string, number> | null;
  error: string | null;
}

export interface SportnetSyncStatus {
  clubs: { activeClubs: number; withoutDetails: number; oldestDetailsAt: string | null };
  runs: SyncRunView[];
}

export const RUNS_SHOWN = 20;

/** State of the club sync for the administration (admin_sfz): club counts and the last runs. */
export async function getSportnetSyncStatus(
  deps: SyncRunDeps,
  actor: CurrentUser | null,
): Promise<SportnetSyncStatus> {
  requireAdmin(requireUser(actor));
  const [stats, runs] = await Promise.all([
    deps.stats(),
    deps.runs.listRuns("sportnet-clubs", RUNS_SHOWN),
  ]);
  return {
    clubs: { ...stats, oldestDetailsAt: stats.oldestDetailsAt?.toISOString() ?? null },
    // who started a manual run stays in the database only
    runs: runs.map((r) => ({
      trigger: r.trigger,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt.toISOString(),
      durationMs: r.finishedAt.getTime() - r.startedAt.getTime(),
      ok: r.ok,
      result: r.result,
      error: r.error,
    })),
  };
}
