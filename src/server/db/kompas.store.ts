import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { KompasAssessmentDoc } from "@/server/db/types";
import type { AssessmentStore } from "@/server/services/kompas.service";

/** Kompas assessments; every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const assessments = (db: Db) => db.collection<KompasAssessmentDoc>("kompas_assessments");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= assessments(db)
    .createIndex({ clubId: 1, season: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoAssessmentStore: AssessmentStore = {
  async findAssessment(clubId, season) {
    const db = await getDb();
    return assessments(db).findOne({ clubId, season }, { projection: { _id: 0 } });
  },
  async saveAssessment(clubId, season, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: KompasAssessmentDoc = {
        clubId,
        season,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await assessments(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return null; // created meanwhile
        throw error;
      }
    }
    return assessments(db).findOneAndUpdate(
      { clubId, season, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};
