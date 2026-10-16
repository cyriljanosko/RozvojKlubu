import "server-only";

import { ObjectId, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type {
  AreaDoc,
  AreaPracticeDoc,
  RoleCatalogDoc,
  AreaSectionDoc,
  ContentRevisionDoc,
  KompasQuestionDoc,
} from "@/server/db/types";
import type { ContentStore, StoredRevision } from "@/server/services/content.service";
import type { SectionStore } from "@/server/services/methodology.service";
import type { PracticeStore } from "@/server/services/practice.service";
import type { RoleCatalogStore } from "@/server/services/role-catalog.service";

/** MongoDB implementation of the managed-content store. Indexes are documented in ARCHITECTURE.md. */
const areas = (db: Db) => db.collection<AreaDoc>("areas");
const questions = (db: Db) => db.collection<KompasQuestionDoc>("kompas_questions");
const revisions = (db: Db) => db.collection<ContentRevisionDoc>("content_revisions");
const sections = (db: Db) => db.collection<AreaSectionDoc>("area_sections");
const practice = (db: Db) => db.collection<AreaPracticeDoc>("area_practice");
const roleCatalog = (db: Db) => db.collection<RoleCatalogDoc>("role_catalog");

let indexes: Promise<unknown> | undefined;

function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= Promise.all([
    areas(db).createIndex({ number: 1 }, { unique: true }),
    questions(db).createIndex({ questionId: 1 }, { unique: true }),
    questions(db).createIndex({ area: 1, column: 1, order: 1 }),
    revisions(db).createIndex({ entity: 1, entityId: 1, version: -1 }),
    sections(db).createIndex({ area: 1, kind: 1, key: 1 }, { unique: true }),
    practice(db).createIndex({ area: 1 }, { unique: true }),
    roleCatalog(db).createIndex({ key: 1 }, { unique: true }),
  ]).catch((error) => {
    indexes = undefined;
    throw error;
  });
  return indexes;
}

const toRevision = ({ _id, ...rest }: ContentRevisionDoc): StoredRevision => ({
  ...rest,
  id: String(_id),
});

export const mongoContentStore: ContentStore = {
  async insertMissing(seed) {
    const db = await getDb();
    await ensureIndexes(db);
    const a = await areas(db).bulkWrite(
      seed.areas.map((doc) => ({
        updateOne: { filter: { number: doc.number }, update: { $setOnInsert: doc }, upsert: true },
      })),
    );
    const q = await questions(db).bulkWrite(
      seed.questions.map((doc) => ({
        updateOne: {
          filter: { questionId: doc.questionId },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
    );
    return { areas: a.upsertedCount, questions: q.upsertedCount };
  },
  async listAreas() {
    const db = await getDb();
    return areas(db)
      .find({}, { projection: { _id: 0 } })
      .toArray();
  },
  async listQuestions(area) {
    const db = await getDb();
    return questions(db)
      .find(area === undefined ? {} : { area }, { projection: { _id: 0 } })
      .toArray();
  },
  async findQuestion(questionId) {
    const db = await getDb();
    return questions(db).findOne({ questionId }, { projection: { _id: 0 } });
  },
  async updateQuestion(questionId, expectedVersion, changes) {
    const db = await getDb();
    return questions(db).findOneAndUpdate(
      { questionId, version: expectedVersion },
      { $set: changes },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
  async addRevision(revision) {
    const db = await getDb();
    await ensureIndexes(db);
    await revisions(db).insertOne({ ...revision });
  },
  async listRevisions(entity, entityId) {
    const db = await getDb();
    return (await revisions(db).find({ entity, entityId }).sort({ version: -1 }).toArray()).map(
      toRevision,
    );
  },
  async findRevision(revisionId) {
    if (!ObjectId.isValid(revisionId)) return null;
    const db = await getDb();
    const doc = await revisions(db).findOne({ _id: new ObjectId(revisionId) });
    return doc ? toRevision(doc) : null;
  },
};

export const mongoSectionStore: SectionStore = {
  async insertMissingSections(docs) {
    if (docs.length === 0) return 0;
    const db = await getDb();
    await ensureIndexes(db);
    const result = await sections(db).bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { area: doc.area, kind: doc.kind, key: doc.key },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
    );
    return result.upsertedCount;
  },
  async listSections(area, kind) {
    const db = await getDb();
    return sections(db)
      .find({ area, kind }, { projection: { _id: 0 } })
      .sort({ order: 1 })
      .toArray();
  },
  async findSection(area, kind, key) {
    const db = await getDb();
    return sections(db).findOne({ area, kind, key }, { projection: { _id: 0 } });
  },
  async updateSection(area, kind, key, expectedVersion, changes) {
    const db = await getDb();
    return sections(db).findOneAndUpdate(
      { area, kind, key, version: expectedVersion },
      { $set: changes },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};

export const mongoPracticeStore: PracticeStore = {
  async insertMissingPractice(docs) {
    if (docs.length === 0) return 0;
    const db = await getDb();
    await ensureIndexes(db);
    const result = await practice(db).bulkWrite(
      docs.map((doc) => ({
        updateOne: { filter: { area: doc.area }, update: { $setOnInsert: doc }, upsert: true },
      })),
    );
    return result.upsertedCount;
  },
  async findPractice(area) {
    const db = await getDb();
    return practice(db).findOne({ area }, { projection: { _id: 0 } });
  },
  async listPracticeAreas() {
    const db = await getDb();
    const docs = await practice(db)
      .find({}, { projection: { _id: 0, area: 1 } })
      .toArray();
    return docs.map((d) => d.area);
  },
  async updatePractice(area, expectedVersion, changes) {
    const db = await getDb();
    return practice(db).findOneAndUpdate(
      { area, version: expectedVersion },
      { $set: changes },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};

export const mongoRoleCatalogStore: RoleCatalogStore = {
  async insertCatalogIfMissing(doc) {
    const db = await getDb();
    await ensureIndexes(db);
    const result = await roleCatalog(db).updateOne(
      { key: "roles" },
      { $setOnInsert: { ...doc } },
      { upsert: true },
    );
    return result.upsertedCount === 1;
  },
  async findCatalog() {
    const db = await getDb();
    return roleCatalog(db).findOne({ key: "roles" }, { projection: { _id: 0 } });
  },
  async updateCatalog(expectedVersion, changes) {
    const db = await getDb();
    return roleCatalog(db).findOneAndUpdate(
      { key: "roles", version: expectedVersion },
      { $set: changes },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  },
};
