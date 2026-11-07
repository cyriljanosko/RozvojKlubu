import "server-only";

import type { Db, Filter } from "mongodb";

import { mongoClubStore } from "@/server/db/clubs.store";
import { getDb } from "@/server/db/mongo";
import type { ClubDoc } from "@/server/db/types";
import {
  NO_REGION,
  type AdminClubFilter,
  type AdminClubStore,
  type UnionOption,
} from "@/server/services/admin-clubs.service";

/**
 * MongoDB store of the administration club list (G5 Kluby). Reads only the global `clubs`
 * collection – the directory of all clubs is admin_sfz data, checked in the service (ADR 0003).
 * About 1 600 documents: no index of its own, sorted in memory (ARCHITECTURE.md).
 */
const clubs = (db: Db) => db.collection<ClubDoc>("clubs");

/** Slovak alphabetical order (č after c, ch after h). */
const COLLATION = { locale: "sk", strength: 1 };

const PROJECTION = {
  _id: 0,
  clubId: 1,
  name: 1,
  union: 1,
  region: 1,
  status: 1,
  logoUrl: 1,
  unionId: 1,
  legalName: 1,
  businessId: 1,
  legalForm: 1,
  sportnetDetailsAt: 1,
} as const;

/** Store filter → MongoDB filter. Pure, so it is tested without a database. */
export function adminClubsMongoFilter(filter: AdminClubFilter): Filter<ClubDoc> {
  const and: Filter<ClubDoc>[] = [];
  if (filter.status) and.push({ status: filter.status });
  // null also matches clubs where the field is missing
  if (filter.region === NO_REGION) and.push({ region: { $in: ["", null] } } as Filter<ClubDoc>);
  else if (filter.region) and.push({ region: filter.region });
  if (filter.unionId) and.push({ unionId: filter.unionId });
  if (filter.namePattern) and.push({ name: { $regex: filter.namePattern, $options: "i" } });
  if (filter.businessIdPrefix) {
    and.push({ businessId: { $regex: `^${filter.businessIdPrefix.replace(/\D/g, "")}` } });
  }
  if (filter.clubIds) {
    and.push({
      clubId: "in" in filter.clubIds ? { $in: filter.clubIds.in } : { $nin: filter.clubIds.nin },
    });
  }
  return and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
}

export const mongoAdminClubStore: AdminClubStore = {
  async searchClubs(filter, page) {
    const db = await getDb();
    const query = adminClubsMongoFilter(filter);
    const [found, total] = await Promise.all([
      clubs(db)
        .find(query, { projection: PROJECTION })
        .collation(COLLATION)
        .sort({ name: 1, clubId: 1 })
        .skip(page.skip)
        .limit(page.limit)
        .toArray(),
      clubs(db).countDocuments(query),
    ]);
    return { clubs: found, total };
  },
  async listUnions(region) {
    const db = await getDb();
    return clubs(db)
      .aggregate<UnionOption>(
        [
          {
            $match: {
              status: "active",
              unionId: { $nin: ["", null] },
              ...(region && { region }),
            },
          },
          {
            $group: {
              _id: "$unionId",
              union: { $first: "$union" },
              region: { $first: "$region" },
            },
          },
          { $project: { _id: 0, unionId: "$_id", union: 1, region: 1 } },
          { $sort: { union: 1 } },
        ],
        { collation: COLLATION },
      )
      .toArray();
  },
  listActiveClubIds: () => mongoClubStore.listActiveClubIds!(),
};
