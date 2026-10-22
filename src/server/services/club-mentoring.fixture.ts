import type { ClubMentoringDoc } from "@/server/db/types";

import type { MentoringStore } from "./club-mentoring.service";

/** In-memory MentoringStore with the same version semantics as the Mongo store. */
export function memoryMentoringStore(): MentoringStore & { docs: ClubMentoringDoc[] } {
  const docs: ClubMentoringDoc[] = [];
  const find = (clubId: string, season: string) =>
    docs.find((x) => x.clubId === clubId && x.season === season);
  return {
    docs,
    findMentoring: async (clubId, season) => {
      const d = find(clubId, season);
      return d ? structuredClone(d) : null;
    },
    async saveMentoring(clubId, season, expectedVersion, changes) {
      const d = find(clubId, season);
      if (expectedVersion === 0) {
        if (d) return null;
        const doc: ClubMentoringDoc = {
          clubId,
          season,
          intro: null,
          focus: null,
          closingClub: null,
          closingMentor: null,
          ...structuredClone(changes),
          version: 1,
          createdAt: changes.updatedAt,
        };
        docs.push(doc);
        return structuredClone(doc);
      }
      if (!d || d.version !== expectedVersion) return null;
      Object.assign(d, structuredClone(changes), { version: d.version + 1 });
      return structuredClone(d);
    },
  };
}
