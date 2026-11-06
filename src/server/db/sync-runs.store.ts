import "server-only";

import type { Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { SyncRunDoc } from "@/server/db/types";
import type { SyncRunStore } from "@/server/services/sync-runs.service";

/** Sync runs (ADR 0030) – global, not club data. Index in ARCHITECTURE.md. */
const runs = (db: Db) => db.collection<SyncRunDoc>("sync_runs");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= runs(db)
    .createIndex({ kind: 1, startedAt: -1 })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoSyncRunStore: SyncRunStore = {
  async insertRun(run) {
    const db = await getDb();
    await ensureIndexes(db);
    await runs(db).insertOne({ ...run });
  },
  async listRuns(kind, limit) {
    const db = await getDb();
    return runs(db)
      .find({ kind }, { projection: { _id: 0 } })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();
  },
};
