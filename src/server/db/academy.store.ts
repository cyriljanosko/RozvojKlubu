import "server-only";

import type { Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { AreaRoleChoiceDoc } from "@/server/db/types";
import type { AreaRoleChoiceStore } from "@/server/services/academy.service";

/** The user's own roles in the areas (F6b); every query filters by clubId (ADR 0003). */
const choices = (db: Db) => db.collection<AreaRoleChoiceDoc>("area_role_choices");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= choices(db)
    .createIndex({ userId: 1, clubId: 1, season: 1 }, { unique: true })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

export const mongoAreaRoleChoiceStore: AreaRoleChoiceStore = {
  async findChoice(userId, clubId, season) {
    const db = await getDb();
    return choices(db).findOne({ userId, clubId, season }, { projection: { _id: 0 } });
  },
  async saveChoice(doc) {
    const db = await getDb();
    await ensureIndexes(db);
    await choices(db).updateOne(
      { userId: doc.userId, clubId: doc.clubId, season: doc.season },
      { $set: { roles: doc.roles, updatedAt: doc.updatedAt } },
      { upsert: true },
    );
    return doc;
  },
};
