import "server-only";

import { ObjectId, type Db } from "mongodb";

import { getDb } from "@/server/db/mongo";
import type { ClubDoc, ClubMembershipDoc, ClubSeasonDoc } from "@/server/db/types";
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

const toStored = ({ _id, ...rest }: ClubMembershipDoc): StoredMembership => ({
  ...rest,
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
    await clubs(db).bulkWrite(
      snapshot.clubs.map((c) => ({
        replaceOne: { filter: { clubId: c.clubId }, replacement: c, upsert: true },
      })),
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
