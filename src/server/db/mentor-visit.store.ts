import "server-only";

import { ObjectId, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { MentorVisitDoc } from "@/server/db/types";
import type { MentorVisitStore, StoredVisit } from "@/server/services/mentor-visit.service";

/** Mentor visits; every query filters by clubId (ADR 0003). Indexes in ARCHITECTURE.md. */
const visits = (db: Db) => db.collection<MentorVisitDoc>("mentor_visits");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= visits(db)
    .createIndex({ clubId: 1, season: 1, date: -1 })
    .catch((error) => {
      indexes = undefined;
      throw error;
    });
  return indexes;
}

/** The first MC-a shape (four flat fields, 22. 10. 2026) read as one general block. */
function normalizeAssessment(value: unknown): MentorVisitDoc["assessment"] {
  if (!value || typeof value !== "object") return null;
  if ("topics" in value) return value as MentorVisitDoc["assessment"];
  const flat = value as Record<string, string>;
  return {
    topics: [
      {
        area: null,
        strengths: flat.strengths ?? "",
        weaknesses: flat.weaknesses ?? "",
        recommendations: flat.recommendations ?? "",
      },
    ],
    overall: flat.overall ?? "",
  };
}

const toStored = ({ _id, ...rest }: MentorVisitDoc): StoredVisit => ({
  ...rest,
  participantIds: rest.participantIds ?? [], // visits recorded before 21. 10. 2026
  // visits recorded before the mentoring cycle (22. 10. 2026)
  topics: rest.topics ?? [],
  assessment: normalizeAssessment(rest.assessment),
  prepTask: rest.prepTask ?? null,
  actions: rest.actions.map((a) => ({
    ...a,
    ownerId: a.ownerId ?? null,
    rating: a.rating ?? null,
  })),
  id: String(_id),
});

export const mongoVisitStore: MentorVisitStore = {
  async insertVisit(doc) {
    const db = await getDb();
    await ensureIndexes(db);
    const { insertedId } = await visits(db).insertOne({ ...doc });
    return { ...doc, id: String(insertedId) };
  },
  async listVisits(clubId) {
    const db = await getDb();
    return (await visits(db).find({ clubId }).sort({ date: -1 }).toArray()).map(toStored);
  },
  async findVisit(clubId, visitId) {
    if (!ObjectId.isValid(visitId)) return null;
    const db = await getDb();
    const doc = await visits(db).findOne({ _id: new ObjectId(visitId), clubId });
    return doc ? toStored(doc) : null;
  },
  async updateVisit(clubId, visitId, expectedVersion, changes) {
    if (!ObjectId.isValid(visitId)) return null;
    const db = await getDb();
    const doc = await visits(db).findOneAndUpdate(
      { _id: new ObjectId(visitId), clubId, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after" },
    );
    return doc ? toStored(doc) : null;
  },
};
