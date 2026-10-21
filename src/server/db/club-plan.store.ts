import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { ClubPlanDoc } from "@/server/db/types";
import type { PlanStore } from "@/server/services/club-plan.service";

/** Club plans per season; every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const plans = (db: Db) => db.collection<ClubPlanDoc>("club_plans");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= plans(db)
    .createIndex({ clubId: 1, season: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoPlanStore: PlanStore = {
  async findPlan(clubId, season) {
    const db = await getDb();
    return plans(db).findOne({ clubId, season }, { projection: { _id: 0 } });
  },
  async savePlan(clubId, season, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: ClubPlanDoc = {
        clubId,
        season,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await plans(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return null; // created meanwhile
        throw error;
      }
    }
    return plans(db).findOneAndUpdate(
      { clubId, season, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};
