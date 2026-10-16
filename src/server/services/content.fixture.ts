import type { AreaDoc, ContentRevisionDoc, KompasQuestionDoc } from "@/server/db/types";

import type { ContentStore, StoredRevision } from "./content.service";

/** In-memory ContentStore for tests (same semantics as the Mongo store). */
export function memoryContentStore(): ContentStore & {
  areaDocs: AreaDoc[];
  questionDocs: KompasQuestionDoc[];
  revisionDocs: StoredRevision[];
} {
  const areaDocs: AreaDoc[] = [];
  const questionDocs: KompasQuestionDoc[] = [];
  const revisionDocs: StoredRevision[] = [];
  let seq = 0;
  return {
    areaDocs,
    questionDocs,
    revisionDocs,
    async insertMissing(seed) {
      const newAreas = seed.areas.filter((a) => !areaDocs.some((x) => x.number === a.number));
      const newQs = seed.questions.filter(
        (q) => !questionDocs.some((x) => x.questionId === q.questionId),
      );
      areaDocs.push(...newAreas);
      questionDocs.push(...newQs);
      return { areas: newAreas.length, questions: newQs.length };
    },
    listAreas: async () => [...areaDocs],
    listQuestions: async (area) =>
      questionDocs.filter((q) => area === undefined || q.area === area),
    findQuestion: async (id) => questionDocs.find((q) => q.questionId === id) ?? null,
    async updateQuestion(id, expectedVersion, changes) {
      const q = questionDocs.find((x) => x.questionId === id && x.version === expectedVersion);
      if (!q) return null;
      Object.assign(q, changes);
      return { ...q };
    },
    async addRevision(revision: Omit<ContentRevisionDoc, "_id">) {
      revisionDocs.push({ ...revision, id: `r${++seq}` });
    },
    listRevisions: async (entity, entityId) =>
      revisionDocs.filter((r) => r.entity === entity && r.entityId === entityId),
    findRevision: async (id) => revisionDocs.find((r) => r.id === id) ?? null,
  };
}
