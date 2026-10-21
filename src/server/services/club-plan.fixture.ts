import type { ClubPlanDoc } from "@/server/db/types";

import type { PlanStore } from "./club-plan.service";

/** In-memory PlanStore with the same version semantics as the Mongo store. */
export function memoryPlanStore(): PlanStore & { docs: ClubPlanDoc[] } {
  const docs: ClubPlanDoc[] = [];
  const find = (clubId: string, season: string) =>
    docs.find((x) => x.clubId === clubId && x.season === season);
  return {
    docs,
    findPlan: async (clubId, season) => {
      const d = find(clubId, season);
      return d ? structuredClone(d) : null;
    },
    async savePlan(clubId, season, expectedVersion, changes) {
      const d = find(clubId, season);
      if (expectedVersion === 0) {
        if (d) return null;
        const doc = {
          clubId,
          season,
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
