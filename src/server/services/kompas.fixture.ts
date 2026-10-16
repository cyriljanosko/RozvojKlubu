import type { KompasAssessmentDoc } from "@/server/db/types";

import type { StoredSubmission, SubmissionStore } from "./kompas-submission.service";

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

/** In-memory SubmissionStore (clubId-scoped like the Mongo store). */
export function memorySubmissionStore(): SubmissionStore & { docs: StoredSubmission[] } {
  const docs: StoredSubmission[] = [];
  let seq = 0;
  return {
    docs,
    async addSubmission(doc) {
      const s = { ...structuredClone(doc), id: `s${++seq}` };
      docs.push(s);
      return structuredClone(s);
    },
    listSubmissions: async (clubId, season) =>
      docs
        .filter((d) => d.clubId === clubId && (!season || d.season === season))
        .map((d) => structuredClone(d)),
    findSubmission: async (clubId, id) => {
      const d = docs.find((x) => x.id === id && x.clubId === clubId);
      return d ? structuredClone(d) : null;
    },
    async withdrawSubmission(clubId, id, withdrawnBy, withdrawnAt) {
      const d = docs.find((x) => x.id === id && x.clubId === clubId && x.status !== "withdrawn");
      if (!d) return null;
      Object.assign(d, { status: "withdrawn", withdrawnBy, withdrawnAt });
      return structuredClone(d);
    },
  };
}
