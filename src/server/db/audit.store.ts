import "server-only";

import type { Db, Filter } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { AuditLogDoc } from "@/server/db/types";
import type {
  AuditAction,
  AuditFilter,
  AuditLog,
  AuditReader,
} from "@/server/services/audit.service";

/** Audit log (ADR 0034) – append-only; this module only inserts and reads. Indexes in ARCHITECTURE.md. */
const auditLog = (db: Db) => db.collection<AuditLogDoc>("audit_log");

/** Entries expire after 3 years (TTL index on `at`). */
export const AUDIT_RETENTION_SECONDS = 3 * 365 * 24 * 60 * 60;

let indexes: Promise<unknown> | undefined;
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= Promise.all([
    auditLog(db).createIndex({ at: 1 }, { expireAfterSeconds: AUDIT_RETENTION_SECONDS }),
    auditLog(db).createIndex({ clubId: 1, at: -1 }),
    auditLog(db).createIndex({ actorId: 1, at: -1 }),
  ]).catch((error) => {
    indexes = undefined;
    throw error;
  });
  return indexes;
}

/** Pure: Mongo filter of the audit listing. */
export function auditMongoFilter(filter: AuditFilter): Filter<AuditLogDoc> {
  const at = {
    ...(filter.from ? { $gte: filter.from } : {}),
    ...(filter.to ? { $lt: filter.to } : {}),
  };
  return {
    ...(filter.clubId ? { clubId: filter.clubId } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(Object.keys(at).length ? { at } : {}),
  };
}

export const mongoAuditLog: AuditLog & AuditReader = {
  async record(entry) {
    const db = await getDb();
    await ensureIndexes(db);
    await auditLog(db).insertOne({ ...entry });
  },
  async list(filter, { skip, limit }) {
    const db = await getDb();
    const query = auditMongoFilter(filter);
    const [docs, total] = await Promise.all([
      auditLog(db).find(query).sort({ at: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      auditLog(db).countDocuments(query),
    ]);
    return {
      entries: docs.map(({ _id, ...doc }) => ({
        ...doc,
        id: String(_id),
        action: doc.action as AuditAction,
      })),
      total,
    };
  },
};
