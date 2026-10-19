import type { PracticeProgressDoc } from "@/server/db/types";

import type { PracticeProgressStore } from "./practice-progress.service";

/** In-memory PracticeProgressStore with the same version semantics as the Mongo store. */
export function memoryProgressStore(): PracticeProgressStore & { docs: PracticeProgressDoc[] } {
  const docs: PracticeProgressDoc[] = [];
  const find = (clubId: string, season: string, area: number) =>
    docs.find((x) => x.clubId === clubId && x.season === season && x.area === area);
  return {
    docs,
    findProgress: async (clubId, season, area) => {
      const d = find(clubId, season, area);
      return d ? structuredClone(d) : null;
    },
    async saveProgress(clubId, season, area, expectedVersion, changes) {
      const d = find(clubId, season, area);
      if (expectedVersion === 0) {
        if (d) return null;
        const doc = { clubId, season, area, ...changes, version: 1, createdAt: changes.updatedAt };
        docs.push(structuredClone(doc));
        return structuredClone(doc);
      }
      if (!d || d.version !== expectedVersion) return null;
      Object.assign(d, structuredClone(changes), { version: d.version + 1 });
      return structuredClone(d);
    },
  };
}
