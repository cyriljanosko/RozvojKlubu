import type { ClubDoc, ClubSeasonDoc } from "@/server/db/types";

import { sampleSnapshot } from "./club-snapshot.fixture";
import { parseSnapshot } from "./club-snapshot.service";
import type { ClubDeps, StoredMembership } from "./clubs.service";
import type { CurrentUser } from "./users.service";

// In-memory stores for tests (fictional people and clubs).
export const admin: CurrentUser = {
  id: "admin",
  email: "admin@sfz.sk",
  name: "Admin",
  role: "admin_sfz",
};
export const alice: CurrentUser = {
  id: "alice",
  email: "alice@klub.sk",
  name: "Alica",
  role: "public",
};
export const bob: CurrentUser = { id: "bob", email: "bob@klub.sk", name: "Bob", role: "public" };

export const A = "tj-test.futbalnet.sk";
export const B = "fk-other.futbalnet.sk";

export function memoryDeps(): ClubDeps & { memberDocs: StoredMembership[] } {
  const parsed = parseSnapshot(sampleSnapshot, new Date("2026-10-16T00:00:00Z"));
  const clubs: ClubDoc[] = [...parsed.clubs, { ...parsed.clubs[0], clubId: B, name: "FK Other" }];
  const seasons: ClubSeasonDoc[] = [...parsed.seasons];
  const memberDocs: StoredMembership[] = [];
  const people = [admin, alice, bob];
  let seq = 0;
  return {
    memberDocs,
    now: () => new Date("2026-10-16T12:00:00Z"),
    clubs: {
      listClubs: async (ids) => clubs.filter((c) => ids === "all" || ids.includes(c.clubId)),
      findClub: async (id) => clubs.find((c) => c.clubId === id) ?? null,
      findSeason: async (id, s) => seasons.find((x) => x.clubId === id && x.season === s) ?? null,
      listSeasonNames: async (id) => seasons.filter((x) => x.clubId === id).map((x) => x.season),
    },
    memberships: {
      listByUser: async (userId) => memberDocs.filter((m) => m.userId === userId),
      listByClub: async (clubId, s) =>
        memberDocs.filter((m) => m.clubId === clubId && m.season === s),
      create: async (doc) => {
        const stored = { ...doc, id: `m${++seq}` };
        memberDocs.push(stored);
        return stored;
      },
      delete: async (clubId, id) => {
        const i = memberDocs.findIndex((m) => m.id === id && m.clubId === clubId);
        if (i < 0) return false;
        memberDocs.splice(i, 1);
        return true;
      },
    },
    users: {
      findById: async (id) => people.find((p) => p.id === id) ?? null,
      findByEmail: async (email) => people.find((p) => p.email === email) ?? null,
    },
  };
}
