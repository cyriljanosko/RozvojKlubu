import "server-only";

import { ObjectId, type Db, type Filter } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { NewsPostDoc } from "@/server/db/types";
import type { NewsScope, NewsStore, StoredNews } from "@/server/services/news.service";

/**
 * Novinky (ADR 0023). Unpublished posts are queried only with explicit clubs (ADR 0003);
 * published ones are public content. Indexes in ARCHITECTURE.md.
 */
const posts = (db: Db) => db.collection<NewsPostDoc>("news_posts");

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= Promise.all([
    posts(db).createIndex({ status: 1, publishedAt: -1 }),
    posts(db).createIndex({ clubId: 1, status: 1 }),
    posts(db).createIndex({ areas: 1, status: 1, publishedAt: -1 }),
    posts(db).createIndex(
      { slug: 1 },
      { unique: true, partialFilterExpression: { slug: { $type: "string" } } },
    ),
  ]).catch((error) => {
    indexes = undefined;
    throw error;
  });
  return indexes;
}

const toStored = ({ _id, ...rest }: NewsPostDoc): StoredNews => ({ ...rest, id: String(_id) });

function scopeFilter(scope: NewsScope): Filter<NewsPostDoc> {
  const or: Filter<NewsPostDoc>[] = [];
  if (scope.clubIds.length > 0) or.push({ clubId: { $in: [...scope.clubIds] } });
  if (scope.academy) or.push({ clubId: null });
  return or.length > 0 ? { $or: or } : { _id: { $exists: false } };
}

const idFilter = (scope: NewsScope, id: string): Filter<NewsPostDoc> | null =>
  ObjectId.isValid(id) ? { _id: new ObjectId(id), ...scopeFilter(scope) } : null;

const objectIds = (ids: readonly string[]) =>
  ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));

export const mongoNewsStore: NewsStore = {
  async insertPost(doc) {
    const db = await getDb();
    await ensureIndexes(db);
    const { insertedId } = await posts(db).insertOne({ ...doc });
    return { ...doc, id: String(insertedId) };
  },
  async findPost(scope, id) {
    const filter = idFilter(scope, id);
    if (!filter) return null;
    const db = await getDb();
    const doc = await posts(db).findOne(filter);
    return doc ? toStored(doc) : null;
  },
  async listPosts(scope, status) {
    const db = await getDb();
    const filter = { ...scopeFilter(scope), ...(status ? { status } : {}) };
    return (await posts(db).find(filter).sort({ updatedAt: -1 }).toArray()).map(toStored);
  },
  async updatePost(scope, id, expectedVersion, changes) {
    const filter = idFilter(scope, id);
    if (!filter) return null;
    const db = await getDb();
    await ensureIndexes(db);
    const doc = await posts(db).findOneAndUpdate(
      { ...filter, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after" },
    );
    return doc ? toStored(doc) : null;
  },
  async findPublishedBySlug(slug) {
    const db = await getDb();
    const doc = await posts(db).findOne({ slug, status: "published" });
    return doc ? toStored(doc) : null;
  },
  async listPublished({ kind, area, before, limit, excludeIds = [] }) {
    const db = await getDb();
    const filter: Filter<NewsPostDoc> = {
      status: "published",
      ...(kind ? { kind } : {}),
      ...(area ? { areas: area } : {}),
      ...(before ? { publishedAt: { $lt: before } } : {}),
      ...(excludeIds.length > 0 ? { _id: { $nin: objectIds(excludeIds) } } : {}),
    };
    return (await posts(db).find(filter).sort({ publishedAt: -1 }).limit(limit).toArray()).map(
      toStored,
    );
  },
  async findPinned() {
    const db = await getDb();
    const doc = await posts(db).findOne({ status: "published", pinned: true });
    return doc ? toStored(doc) : null;
  },
  async clearPinned() {
    const db = await getDb();
    await posts(db).updateMany({ pinned: true }, { $set: { pinned: false } });
  },
  async slugExists(slug) {
    const db = await getDb();
    return (await posts(db).countDocuments({ slug }, { limit: 1 })) > 0;
  },
  async incrementViews(id) {
    if (!ObjectId.isValid(id)) return;
    const db = await getDb();
    await posts(db).updateOne(
      { _id: new ObjectId(id), status: "published" },
      { $inc: { views: 1 } },
    );
  },
};
