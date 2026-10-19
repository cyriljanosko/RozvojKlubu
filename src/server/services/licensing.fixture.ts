import type { LicensingEvaluationDoc } from "@/server/db/types";

import type {
  EvaluationStore,
  LicensingSubmissionStore,
  StoredLicensingSubmission,
} from "./licensing.service";

/** In-memory EvaluationStore with the same version semantics as the Mongo store. */
export function memoryEvaluationStore(): EvaluationStore & { docs: LicensingEvaluationDoc[] } {
  const docs: LicensingEvaluationDoc[] = [];
  return {
    docs,
    findEvaluation: async (clubId, season) => {
      const d = docs.find((x) => x.clubId === clubId && x.season === season);
      return d ? structuredClone(d) : null;
    },
    async saveEvaluation(clubId, season, expectedVersion, changes) {
      const d = docs.find((x) => x.clubId === clubId && x.season === season);
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

const isValid = (d: StoredLicensingSubmission) => d.status !== "reopened";

/** In-memory LicensingSubmissionStore – one valid closing per club and season. */
export function memoryLicensingSubmissionStore(): LicensingSubmissionStore & {
  docs: StoredLicensingSubmission[];
} {
  const docs: StoredLicensingSubmission[] = [];
  let seq = 0;
  return {
    docs,
    async addSubmission(doc) {
      if (docs.some((d) => d.clubId === doc.clubId && d.season === doc.season && isValid(d)))
        return null;
      const s = { ...structuredClone(doc), id: `l${++seq}` };
      docs.push(s);
      return structuredClone(s);
    },
    findSubmission: async (clubId, season) => {
      const d = docs.find((x) => x.clubId === clubId && x.season === season && isValid(x));
      return d ? structuredClone(d) : null;
    },
    async reopenSubmission(clubId, season, reopenedBy, reopenedAt) {
      const d = docs.find((x) => x.clubId === clubId && x.season === season && isValid(x));
      if (!d) return null;
      Object.assign(d, { status: "reopened", reopenedBy, reopenedAt });
      return structuredClone(d);
    },
    listSubmissions: async (clubId) =>
      docs.filter((d) => d.clubId === clubId).map((d) => structuredClone(d)),
  };
}
