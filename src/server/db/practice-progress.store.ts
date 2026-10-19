import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { PracticeProgressDoc } from "@/server/db/types";
import type { PracticeProgressStore } from "@/server/services/practice-progress.service";

/** Practice progress of clubs; every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const progress = (db: Db) => db.collection<PracticeProgressDoc>("practice_progress");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= progress(db)
    .createIndex({ clubId: 1, season: 1, area: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoProgressStore: PracticeProgressStore = {
  async findProgress(clubId, season, area) {
    const db = await getDb();
    return progress(db).findOne({ clubId, season, area }, { projection: { _id: 0 } });
  },
  async saveProgress(clubId, season, area, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: PracticeProgressDoc = {
        clubId,
        season,
        area,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await progress(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return null; // created meanwhile
        throw error;
      }
    }
    return progress(db).findOneAndUpdate(
      { clubId, season, area, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};
