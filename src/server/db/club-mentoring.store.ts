import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { ClubMentoringDoc } from "@/server/db/types";
import type { MentoringStore } from "@/server/services/club-mentoring.service";

/** The club's mentoring cycle per season; every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const mentoring = (db: Db) => db.collection<ClubMentoringDoc>("club_mentoring");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= mentoring(db)
    .createIndex({ clubId: 1, season: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoMentoringStore: MentoringStore = {
  async findMentoring(clubId, season) {
    const db = await getDb();
    return mentoring(db).findOne({ clubId, season }, { projection: { _id: 0 } });
  },
  async saveMentoring(clubId, season, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: ClubMentoringDoc = {
        clubId,
        season,
        intro: null,
        focus: null,
        closingClub: null,
        closingMentor: null,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await mentoring(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return null; // created meanwhile
        throw error;
      }
    }
    return mentoring(db).findOneAndUpdate(
      { clubId, season, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};
