import type { AreaRoleChoiceDoc } from "@/server/db/types";

import type { AreaRoleChoiceStore } from "./academy.service";

/** In-memory AreaRoleChoiceStore (one document per user, club and season). */
export function memoryChoiceStore(): AreaRoleChoiceStore & { docs: AreaRoleChoiceDoc[] } {
  const docs: AreaRoleChoiceDoc[] = [];
  return {
    docs,
    findChoice: async (userId, clubId, season) => {
      const d = docs.find((x) => x.userId === userId && x.clubId === clubId && x.season === season);
      return d ? structuredClone(d) : null;
    },
    async saveChoice(doc) {
      const i = docs.findIndex(
        (x) => x.userId === doc.userId && x.clubId === doc.clubId && x.season === doc.season,
      );
      if (i >= 0) docs[i] = structuredClone(doc);
      else docs.push(structuredClone(doc));
      return structuredClone(doc);
    },
  };
}
