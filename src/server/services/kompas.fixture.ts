import type { KompasAssessmentDoc } from "@/server/db/types";

import type { AssessmentStore } from "./kompas.service";

/** In-memory AssessmentStore with the same version semantics as the Mongo store. */
export function memoryAssessmentStore(): AssessmentStore & { docs: KompasAssessmentDoc[] } {
  const docs: KompasAssessmentDoc[] = [];
  return {
    docs,
    findAssessment: async (clubId, season) => {
      const d = docs.find((x) => x.clubId === clubId && x.season === season);
      return d ? structuredClone(d) : null;
    },
    async saveAssessment(clubId, season, expectedVersion, changes) {
      const d = docs.find((x) => x.clubId === clubId && x.season === season);
      if (expectedVersion === 0) {
        if (d) return null;
        const doc = { clubId, season, ...changes, version: 1, createdAt: changes.updatedAt };
        docs.push(doc);
        return structuredClone(doc);
      }
      if (!d || d.version !== expectedVersion) return null;
      Object.assign(d, changes, { version: d.version + 1 });
      return structuredClone(d);
    },
  };
}
