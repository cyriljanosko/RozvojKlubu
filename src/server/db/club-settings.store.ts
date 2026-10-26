import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { ClubSettingsDoc } from "@/server/db/types";
import type { ClubSettingsStore } from "@/server/services/club-settings.service";

/** The club's own settings; every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const settings = (db: Db) => db.collection<ClubSettingsDoc>("club_settings");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= settings(db)
    .createIndex({ clubId: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoClubSettingsStore: ClubSettingsStore = {
  async findSettings(clubId) {
    const db = await getDb();
    return settings(db).findOne({ clubId }, { projection: { _id: 0 } });
  },
  async saveSettings(clubId, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: ClubSettingsDoc = {
        clubId,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await settings(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return null; // created meanwhile
        throw error;
      }
    }
    return settings(db).findOneAndUpdate(
      { clubId, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
  async listRankingConsents() {
    // small collection (one document per club in the Academy): a scan is fine, no extra index
    const db = await getDb();
    const docs = await settings(db)
      .find({ "rankingConsent.given": true }, { projection: { _id: 0, clubId: 1 } })
      .toArray();
    return docs.map((d) => d.clubId);
  },
};
