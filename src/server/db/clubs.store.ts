import "server-only";

import { ObjectId, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { ClubDoc, ClubMembershipDoc, ClubSeasonDoc } from "@/server/db/types";
import type { ClubImportStore } from "@/server/services/club-import.service";
import type { ClubRolesSyncDeps } from "@/server/services/club-roles-sync.service";
import type { SnapshotStore } from "@/server/services/club-snapshot.service";
import type { ClubStore, MembershipStore, StoredMembership } from "@/server/services/clubs.service";

/**
 * MongoDB implementations of the club stores. Every query on club data filters by `clubId`
 * (ADR 0003); the "all clubs" listing is used only by admin_sfz (checked in the service).
 * Indexes are documented in ARCHITECTURE.md.
 */
const clubs = (db: Db) => db.collection<ClubDoc>("clubs");
const seasons = (db: Db) => db.collection<ClubSeasonDoc>("club_seasons");
const memberships = (db: Db) => db.collection<ClubMembershipDoc>("club_memberships");

let indexes: Promise<unknown> | undefined;

/** Idempotent; runs once per server instance before the first write. */
function ensureIndexes(db: Db): Promise<unknown> {
  indexes ??= Promise.all([
    clubs(db).createIndex({ clubId: 1 }, { unique: true }),
    seasons(db).createIndex({ clubId: 1, season: 1 }, { unique: true }),
    memberships(db).createIndex({ userId: 1, season: 1 }),
    memberships(db).createIndex(
      { clubId: 1, season: 1, userId: 1, role: 1 },
      { unique: true, name: "club_season_user_role" },
    ),
  ]).catch((error) => {
    indexes = undefined; // retry on the next write
    throw error;
  });
  return indexes;
}

/**
 * Role code before S2-b stage 2. Read as "club_manager" until the migration has run, so a
 * deploy before the migration takes no rights away (scripts/migrate-club-roles.mjs).
 */
const LEGACY_CLUB_MANAGER = "management";
const normalizeRole = (role: string): ClubMembershipDoc["role"] =>
  (role === LEGACY_CLUB_MANAGER ? "club_manager" : role) as ClubMembershipDoc["role"];

const toStored = ({ _id, ...rest }: ClubMembershipDoc): StoredMembership => ({
  ...rest,
  role: normalizeRole(rest.role),
  id: String(_id),
});

export const mongoClubStore: ClubStore = {
  async listClubs(clubIds) {
    const db = await getDb();
    const filter = clubIds === "all" ? {} : { clubId: { $in: [...clubIds] } };
    return clubs(db)
      .find(filter, { projection: { _id: 0 } })
      .toArray();
  },
  async listActiveClubIds() {
    const db = await getDb();
    // Every collection holding club data; one distinct per collection (indexed on clubId).
    const lists = await Promise.all(
      [
        "club_seasons",
        "club_memberships",
        "kompas_assessments",
        "kompas_submissions",
        "licensing_evaluations",
        "licensing_submissions",
        "club_plans",
        "mentor_visits",
        "club_mentoring",
        "club_settings",
        "practice_progress",
      ].map((name) => db.collection(name).distinct("clubId")),
    );
    return [...new Set(lists.flat().filter((id): id is string => typeof id === "string"))];
  },
  async findClub(clubId) {
    const db = await getDb();
    return clubs(db).findOne({ clubId }, { projection: { _id: 0 } });
  },
  async findSeason(clubId, season) {
    const db = await getDb();
    return seasons(db).findOne({ clubId, season }, { projection: { _id: 0 } });
  },
  async listSeasonNames(clubId) {
    const db = await getDb();
    const docs = await seasons(db)
      .find({ clubId }, { projection: { _id: 0, season: 1 } })
      .toArray();
    return docs.map((d) => d.season);
  },
};

export const mongoMembershipStore: MembershipStore = {
  async listByUser(userId) {
    const db = await getDb();
    return (await memberships(db).find({ userId }).toArray()).map(toStored);
  },
  async listByClub(clubId, season) {
    const db = await getDb();
    return (await memberships(db).find({ clubId, season }).sort({ createdAt: 1 }).toArray()).map(
      toStored,
    );
  },
  async create(doc) {
    const db = await getDb();
    await ensureIndexes(db);
    const { insertedId } = await memberships(db).insertOne({ ...doc });
    return { ...doc, id: String(insertedId) };
  },
  async delete(clubId, membershipId) {
    if (!ObjectId.isValid(membershipId)) return false;
    const db = await getDb();
    const { deletedCount } = await memberships(db).deleteOne({
      _id: new ObjectId(membershipId),
      clubId,
    });
    return deletedCount === 1;
  },
};

export const mongoSnapshotStore: SnapshotStore = {
  async saveSnapshot(snapshot) {
    const db = await getDb();
    await ensureIndexes(db);
    // A club refreshed from Sportnet keeps its name, union and region (ADR 0028); the snapshot
    // still brings the slug and the season data.
    const synced = new Set(
      (
        await clubs(db)
          .find(
            {
              clubId: { $in: snapshot.clubs.map((c) => c.clubId) },
              sportnetSyncedAt: { $exists: true },
            },
            { projection: { _id: 0, clubId: 1 } },
          )
          .toArray()
      ).map((c) => c.clubId),
    );
    await clubs(db).bulkWrite(
      snapshot.clubs.map((c) =>
        synced.has(c.clubId)
          ? {
              updateOne: {
                filter: { clubId: c.clubId },
                update: { $set: { slug: c.slug, dataAsOf: c.dataAsOf, importedAt: c.importedAt } },
              },
            }
          : { replaceOne: { filter: { clubId: c.clubId }, replacement: c, upsert: true } },
      ),
    );
    await seasons(db).bulkWrite(
      snapshot.seasons.map((s) => ({
        replaceOne: {
          filter: { clubId: s.clubId, season: s.season },
          replacement: s,
          upsert: true,
        },
      })),
    );
    return { clubs: snapshot.clubs.length, seasons: snapshot.seasons.length };
  },
};

/** Writes of the Sportnet club-role sync at sign-in (club-roles-sync.service, ADR 0026). */
export const mongoClubRolesSyncStore: Omit<
  ClubRolesSyncDeps,
  "fetchAppspaces" | "fetchAffiliations" | "now"
> = {
  async listKnownClubIds(clubIds) {
    const db = await getDb();
    const found = await clubs(db)
      .find({ clubId: { $in: clubIds } }, { projection: { _id: 0, clubId: 1 } })
      .toArray();
    return found.map((c) => c.clubId);
  },
  async insertMissingClubs(docs) {
    const db = await getDb();
    await ensureIndexes(db);
    const result = await clubs(db).bulkWrite(
      docs.map((c) => ({
        updateOne: { filter: { clubId: c.clubId }, update: { $setOnInsert: c }, upsert: true },
      })),
    );
    return result.upsertedCount;
  },
  async listUserLinks(userId) {
    const db = await getDb();
    const links = await memberships(db)
      .find({ userId }, { projection: { _id: 0, clubId: 1, role: 1, season: 1, source: 1 } })
      .toArray();
    return links.map((l) => ({ ...l, role: normalizeRole(l.role) }));
  },
  async replaceSportnetLinks(userId, season, links) {
    const db = await getDb();
    await ensureIndexes(db);
    await memberships(db).deleteMany({ userId, season, source: "sportnet" });
    if (links.length > 0) await memberships(db).insertMany(links.map((l) => ({ ...l })));
  },
};

// Active clubs whose union, region and legal entity have not been read from their profile yet.
const withoutDetails = { status: "active", sportnetDetailsAt: { $exists: false } };

export const mongoClubImportStore: ClubImportStore = {
  async listClubsForImport() {
    const db = await getDb();
    return clubs(db)
      .find({}, { projection: { _id: 0, clubId: 1 } })
      .toArray();
  },
  async applyClubImport(plan) {
    const db = await getDb();
    await ensureIndexes(db);
    const ops = [
      ...plan.create.map((c) => ({
        updateOne: { filter: { clubId: c.clubId }, update: { $setOnInsert: c }, upsert: true },
      })),
      ...plan.update.map((u) => ({
        updateOne: { filter: { clubId: u.clubId }, update: { $set: u.set } },
      })),
    ];
    // batches keep each request small on the M0 cluster
    for (let i = 0; i < ops.length; i += 500) {
      await clubs(db).bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }
  },
  async listClubsWithoutDetails(limit) {
    const db = await getDb();
    const [pending, active] = await Promise.all([
      clubs(db)
        .find(withoutDetails, { projection: { _id: 0, clubId: 1, name: 1, union: 1, region: 1 } })
        .sort({ clubId: 1 })
        .toArray(),
      mongoClubStore.listActiveClubIds!(),
    ]);
    // clubs used in the app first, so they get their union before the rest
    const used = new Set(active);
    return [
      ...pending.filter((c) => used.has(c.clubId)),
      ...pending.filter((c) => !used.has(c.clubId)),
    ].slice(0, limit);
  },
  async countClubsWithoutDetails() {
    const db = await getDb();
    return clubs(db).countDocuments(withoutDetails);
  },
  async setClubDetails(clubId, details) {
    const db = await getDb();
    const set = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined));
    await clubs(db).updateOne({ clubId }, { $set: set });
  },
};
