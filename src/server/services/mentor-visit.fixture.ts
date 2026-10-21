import type { MentorVisitStore, StoredVisit } from "./mentor-visit.service";

/** In-memory MentorVisitStore (clubId-scoped, version-guarded like the Mongo store). */
export function memoryVisitStore(): MentorVisitStore & { docs: StoredVisit[] } {
  const docs: StoredVisit[] = [];
  let seq = 0;
  return {
    docs,
    async insertVisit(doc) {
      const v = { ...structuredClone(doc), id: `v${++seq}` };
      docs.push(v);
      return structuredClone(v);
    },
    listVisits: async (clubId) =>
      docs.filter((d) => d.clubId === clubId).map((d) => structuredClone(d)),
    findVisit: async (clubId, id) => {
      const d = docs.find((x) => x.clubId === clubId && x.id === id);
      return d ? structuredClone(d) : null;
    },
    async updateVisit(clubId, id, expectedVersion, changes) {
      const d = docs.find(
        (x) => x.clubId === clubId && x.id === id && x.version === expectedVersion,
      );
      if (!d) return null;
      Object.assign(d, structuredClone(changes), { version: d.version + 1 });
      return structuredClone(d);
    },
  };
}
