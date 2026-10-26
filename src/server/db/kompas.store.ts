import "server-only";

import { MongoServerError, ObjectId, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { KompasAssessmentDoc, KompasSubmissionDoc } from "@/server/db/types";
import type {
  StoredSubmission,
  SubmissionStore,
} from "@/server/services/kompas-submission.service";
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

const submissions = (db: Db) => db.collection<KompasSubmissionDoc>("kompas_submissions");
let submissionIndexes: Promise<unknown> | undefined;
function ensureSubmissionIndexes(db: Db): Promise<unknown> {
  submissionIndexes ??= submissions(db)
    .createIndex({ clubId: 1, season: 1, submittedAt: -1 })
    .catch((error) => {
      submissionIndexes = undefined;
      throw error;
    });
  return submissionIndexes;
}

const toStored = ({ _id, ...rest }: KompasSubmissionDoc): StoredSubmission => ({
  ...rest,
  id: String(_id),
});

export const mongoSubmissionStore: SubmissionStore = {
  async addSubmission(doc) {
    const db = await getDb();
    await ensureSubmissionIndexes(db);
    const { insertedId } = await submissions(db).insertOne({ ...doc });
    return { ...doc, id: String(insertedId) };
  },
  async listSubmissions(clubId, season) {
    const db = await getDb();
    const filter = season ? { clubId, season } : { clubId };
    return (await submissions(db).find(filter).sort({ submittedAt: -1 }).toArray()).map(toStored);
  },
  async findSubmission(clubId, submissionId) {
    if (!ObjectId.isValid(submissionId)) return null;
    const db = await getDb();
    const doc = await submissions(db).findOne({ _id: new ObjectId(submissionId), clubId });
    return doc ? toStored(doc) : null;
  },
  async withdrawSubmission(clubId, submissionId, withdrawnBy, withdrawnAt) {
    if (!ObjectId.isValid(submissionId)) return null;
    const db = await getDb();
    const doc = await submissions(db).findOneAndUpdate(
      { _id: new ObjectId(submissionId), clubId, status: { $ne: "withdrawn" } },
      { $set: { status: "withdrawn", withdrawnBy, withdrawnAt } },
      { returnDocument: "after" },
    );
    return doc ? toStored(doc) : null;
  },
  async setConfirmation(clubId, submissionId, confirmation) {
    if (!ObjectId.isValid(submissionId)) return null;
    const db = await getDb();
    const doc = await submissions(db).findOneAndUpdate(
      { _id: new ObjectId(submissionId), clubId, status: { $ne: "withdrawn" } },
      confirmation
        ? { $set: { confirmedBy: confirmation.by, confirmedAt: confirmation.at } }
        : { $unset: { confirmedBy: "", confirmedAt: "" } },
      { returnDocument: "after" },
    );
    return doc ? toStored(doc) : null;
  },
};
