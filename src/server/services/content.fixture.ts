import type {
  AreaDoc,
  AreaPracticeDoc,
  AreaSectionDoc,
  ContentRevisionDoc,
  KompasQuestionDoc,
  RoleCatalogDoc,
} from "@/server/db/types";

import type { ContentStore, StoredRevision } from "./content.service";
import type { SectionStore } from "./methodology.service";
import type { PracticeStore } from "./practice.service";
import type { RoleCatalogStore } from "./role-catalog.service";

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

/** In-memory SectionStore sharing revisions with a memory ContentStore. */
export function memorySectionStore(
  content: ReturnType<typeof memoryContentStore>,
): SectionStore & ReturnType<typeof memoryContentStore> & { sectionDocs: AreaSectionDoc[] } {
  const sectionDocs: AreaSectionDoc[] = [];
  const same = (s: AreaSectionDoc, area: number, kind: string, key: string) =>
    s.area === area && s.kind === kind && s.key === key;
  return {
    ...content,
    sectionDocs,
    async insertMissingSections(docs) {
      const fresh = docs.filter((d) => !sectionDocs.some((s) => same(s, d.area, d.kind, d.key)));
      sectionDocs.push(...fresh.map((d) => ({ ...d })));
      return fresh.length;
    },
    listSections: async (area, kind) =>
      sectionDocs.filter((s) => s.area === area && s.kind === kind).map((s) => ({ ...s })),
    findSection: async (area, kind, key) => {
      const s = sectionDocs.find((x) => same(x, area, kind, key));
      return s ? { ...s } : null;
    },
    async updateSection(area, kind, key, expectedVersion, changes) {
      const s = sectionDocs.find((x) => same(x, area, kind, key) && x.version === expectedVersion);
      if (!s) return null;
      Object.assign(s, changes);
      return { ...s };
    },
  };
}

/** In-memory PracticeStore sharing revisions with a memory ContentStore. */
export function memoryPracticeStore(
  content: ReturnType<typeof memoryContentStore>,
): PracticeStore & ReturnType<typeof memoryContentStore> & { practiceDocs: AreaPracticeDoc[] } {
  const practiceDocs: AreaPracticeDoc[] = [];
  return {
    ...content,
    practiceDocs,
    async insertMissingPractice(docs) {
      const fresh = docs.filter((d) => !practiceDocs.some((p) => p.area === d.area));
      practiceDocs.push(...fresh.map((d) => structuredClone(d)));
      return fresh.length;
    },
    findPractice: async (area) => {
      const p = practiceDocs.find((x) => x.area === area);
      return p ? structuredClone(p) : null;
    },
    listPracticeAreas: async () => practiceDocs.map((p) => p.area),
    async updatePractice(area, expectedVersion, changes) {
      const p = practiceDocs.find((x) => x.area === area && x.version === expectedVersion);
      if (!p) return null;
      Object.assign(p, structuredClone(changes));
      return structuredClone(p);
    },
  };
}

/** In-memory RoleCatalogStore sharing revisions with a memory ContentStore. */
export function memoryRoleCatalogStore(
  content: ReturnType<typeof memoryContentStore>,
): RoleCatalogStore & ReturnType<typeof memoryContentStore> & { catalog: RoleCatalogDoc | null } {
  const state: { catalog: RoleCatalogDoc | null } = { catalog: null };
  return Object.assign(content, {
    get catalog() {
      return state.catalog;
    },
    async insertCatalogIfMissing(doc: RoleCatalogDoc) {
      if (state.catalog) return false;
      state.catalog = structuredClone(doc);
      return true;
    },
    findCatalog: async () => (state.catalog ? structuredClone(state.catalog) : null),
    async updateCatalog(
      expectedVersion: number,
      changes: Pick<RoleCatalogDoc, "content" | "version" | "updatedAt" | "updatedBy">,
    ) {
      if (!state.catalog || state.catalog.version !== expectedVersion) return null;
      Object.assign(state.catalog, structuredClone(changes));
      return structuredClone(state.catalog);
    },
  });
}
