import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { UserPreferencesDoc } from "@/server/db/types";
import type { PreferencesStore } from "@/server/services/preferences.service";

/** One document per user (personal, not club data). Indexes in ARCHITECTURE.md. */
const preferences = (db: Db) => db.collection<UserPreferencesDoc>("user_preferences");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= preferences(db)
    .createIndex({ userId: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoPreferencesStore: PreferencesStore = {
  async findPreferences(userId) {
    const db = await getDb();
    return preferences(db).findOne({ userId }, { projection: { _id: 0 } });
  },
  async savePreferences(userId, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: UserPreferencesDoc = {
        userId,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await preferences(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return null; // created meanwhile
        throw error;
      }
    }
    return preferences(db).findOneAndUpdate(
      { userId, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};
