import "server-only";

import { MongoServerError, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { LicensingEvaluationDoc, LicensingSubmissionDoc } from "@/server/db/types";
import type {
  EvaluationStore,
  LicensingSubmissionStore,
  StoredLicensingSubmission,
} from "@/server/services/licensing.service";

/** Licensing evaluations (ADR 0006); every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const evaluations = (db: Db) => db.collection<LicensingEvaluationDoc>("licensing_evaluations");
const submissions = (db: Db) => db.collection<LicensingSubmissionDoc>("licensing_submissions");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= Promise.all([
    evaluations(db).createIndex({ clubId: 1, season: 1 }, { unique: true }),
    // one valid closing per season; reopened closings stay as history (ADR 0008)
    submissions(db).createIndex(
      { clubId: 1, season: 1 },
      {
        name: "club_season_closed",
        unique: true,
        partialFilterExpression: { status: "closed" },
      },
    ),
  ]).catch((error) => {
    indexes = undefined;
    throw error;
  });
  return indexes;
}

const isDuplicate = (error: unknown) => error instanceof MongoServerError && error.code === 11000;

export const mongoEvaluationStore: EvaluationStore = {
  async findEvaluation(clubId, season) {
    const db = await getDb();
    return evaluations(db).findOne({ clubId, season }, { projection: { _id: 0 } });
  },
  async saveEvaluation(clubId, season, expectedVersion, changes) {
    const db = await getDb();
    await ensureIndexes(db);
    if (expectedVersion === 0) {
      const doc: LicensingEvaluationDoc = {
        clubId,
        season,
        ...changes,
        version: 1,
        createdAt: changes.updatedAt,
      };
      try {
        await evaluations(db).insertOne({ ...doc });
        return doc;
      } catch (error) {
        if (isDuplicate(error)) return null; // created meanwhile
        throw error;
      }
    }
    return evaluations(db).findOneAndUpdate(
      { clubId, season, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};

const toStored = ({ _id, ...rest }: LicensingSubmissionDoc): StoredLicensingSubmission => ({
  ...rest,
  id: String(_id),
});

export const mongoLicensingSubmissionStore: LicensingSubmissionStore = {
  async addSubmission(doc) {
    const db = await getDb();
    await ensureIndexes(db);
    try {
      const { insertedId } = await submissions(db).insertOne({ ...doc });
      return { ...doc, id: String(insertedId) };
    } catch (error) {
      if (isDuplicate(error)) return null; // season already closed
      throw error;
    }
  },
  async findSubmission(clubId, season) {
    const db = await getDb();
    const doc = await submissions(db).findOne({ clubId, season, status: { $ne: "reopened" } });
    return doc ? toStored(doc) : null;
  },
  async reopenSubmission(clubId, season, reopenedBy, reopenedAt) {
    const db = await getDb();
    const doc = await submissions(db).findOneAndUpdate(
      { clubId, season, status: { $ne: "reopened" } },
      { $set: { status: "reopened", reopenedBy, reopenedAt } },
      { returnDocument: "after" },
    );
    return doc ? toStored(doc) : null;
  },
  async listSubmissions(clubId) {
    const db = await getDb();
    return (await submissions(db).find({ clubId }).sort({ season: -1 }).toArray()).map(toStored);
  },
};
