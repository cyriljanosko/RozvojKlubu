import { z } from "zod";

import seedData from "../../../content/kompas-areas.json";
import { ApiError } from "@/server/api/errors";
import {
  QUESTION_TAGS,
  type AreaDoc,
  type ContentRevisionDoc,
  type KompasQuestionDoc,
  type QuestionColumn,
} from "@/server/db/types";
import { requireAdmin } from "@/server/services/club-access";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Managed content: the 11 areas and the 220 Kompas questions.
 * Read access for every signed-in user (pilot decision 16. 10. 2026), edits for admin_sfz.
 * Every edit bumps `version` and stores a revision (before/after) so it can be reverted.
 */

const tagSchema = z.enum(QUESTION_TAGS);

const seedSchema = z.object({
  areas: z
    .array(
      z.object({
        number: z.number().int().min(1).max(11),
        name: z.string().min(1),
        shortName: z.string().min(1),
        band: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        description: z.string().min(1),
        sources: z.object({ overview: z.url(), detail: z.url() }),
        questions: z.object({
          i: z.array(z.object({ text: z.string().min(1), tags: z.array(tagSchema) })).length(10),
          s: z.array(z.object({ text: z.string().min(1), tags: z.array(tagSchema) })).length(10),
        }),
      }),
    )
    .length(11),
});

export const questionId = (area: number, column: QuestionColumn, order: number) =>
  `${area}.${column}.${order}`;

export interface ContentSeed {
  areas: AreaDoc[];
  questions: KompasQuestionDoc[];
}

/** Builds version-1 documents from the bundled seed file (content/kompas-areas.json). */
export function buildContentSeed(raw: unknown = seedData, at: Date = new Date()): ContentSeed {
  const { areas } = seedSchema.parse(raw);
  const meta = { version: 1, updatedAt: at, updatedBy: "seed" };
  return {
    areas: areas.map((a) => ({
      number: a.number,
      name: a.name,
      shortName: a.shortName,
      band: a.band,
      description: a.description,
      sources: a.sources,
      ...meta,
    })),
    questions: areas.flatMap((a) =>
      (["i", "s"] as const).flatMap((column) =>
        a.questions[column].map((q, idx) => ({
          questionId: questionId(a.number, column, idx + 1),
          area: a.number,
          column,
          order: idx + 1,
          text: q.text,
          tags: [...new Set(q.tags)],
          ...meta,
        })),
      ),
    ),
  };
}

export interface ContentStore {
  /** Inserts documents that do not exist yet; never overwrites (edited content wins). */
  insertMissing: (seed: ContentSeed) => Promise<{ areas: number; questions: number }>;
  listAreas: () => Promise<AreaDoc[]>;
  listQuestions: (area?: number) => Promise<KompasQuestionDoc[]>;
  findQuestion: (questionId: string) => Promise<KompasQuestionDoc | null>;
  /** Atomic update guarded by `expectedVersion`; returns null on a version conflict. */
  updateQuestion: (
    questionId: string,
    expectedVersion: number,
    changes: Pick<KompasQuestionDoc, "text" | "tags" | "version" | "updatedAt" | "updatedBy">,
  ) => Promise<KompasQuestionDoc | null>;
  addRevision: (revision: Omit<ContentRevisionDoc, "_id">) => Promise<void>;
  listRevisions: (
    entity: ContentRevisionDoc["entity"],
    entityId: string,
  ) => Promise<StoredRevision[]>;
  findRevision: (revisionId: string) => Promise<StoredRevision | null>;
}

export type StoredRevision = Omit<ContentRevisionDoc, "_id"> & { id: string };

// ---- DTOs ----

export type AreaDto = Omit<AreaDoc, "_id" | "updatedBy">;
export type QuestionDto = Omit<KompasQuestionDoc, "_id" | "updatedBy">;

function omitInternal<T extends { _id?: unknown; updatedBy: string }>(
  doc: T,
): Omit<T, "_id" | "updatedBy"> {
  const copy: Partial<T> = { ...doc };
  delete copy._id;
  delete copy.updatedBy;
  return copy as Omit<T, "_id" | "updatedBy">;
}

const areaDto = (a: AreaDoc): AreaDto => omitInternal(a);
const questionDto = (q: KompasQuestionDoc): QuestionDto => omitInternal(q);

export async function listAreas(
  store: ContentStore,
  actor: CurrentUser | null,
): Promise<AreaDto[]> {
  requireUser(actor);
  return (await store.listAreas()).sort((a, b) => a.number - b.number).map(areaDto);
}

export async function listQuestions(
  store: ContentStore,
  actor: CurrentUser | null,
  area?: number,
): Promise<QuestionDto[]> {
  requireUser(actor);
  if (area !== undefined && (!Number.isInteger(area) || area < 1 || area > 11)) {
    throw new ApiError("BAD_REQUEST", "Invalid area");
  }
  return (await store.listQuestions(area))
    .sort((a, b) => a.area - b.area || a.column.localeCompare(b.column) || a.order - b.order)
    .map(questionDto);
}

export async function seedContent(
  store: ContentStore,
  actor: CurrentUser | null,
  at: Date = new Date(),
): Promise<{ areas: number; questions: number }> {
  requireAdmin(requireUser(actor));
  return store.insertMissing(buildContentSeed(seedData, at));
}

export const updateQuestionSchema = z.object({
  text: z.string().trim().min(5).max(500),
  tags: z.array(tagSchema).max(QUESTION_TAGS.length),
  expectedVersion: z.number().int().positive(),
});

const snapshotOf = (q: KompasQuestionDoc) => ({ text: q.text, tags: q.tags });

export async function updateQuestion(
  store: ContentStore,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
  at: Date = new Date(),
): Promise<QuestionDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const data = updateQuestionSchema.parse(input);
  const current = await store.findQuestion(id);
  if (!current) throw new ApiError("NOT_FOUND", "Question not found");
  if (current.version !== data.expectedVersion) {
    throw new ApiError("CONFLICT", "Question was changed by someone else");
  }
  const tags = [...new Set(data.tags)];
  if (current.text === data.text && current.tags.join() === tags.join())
    return questionDto(current);

  const before = snapshotOf(current); // taken before the write (stores may return live objects)
  const updated = await store.updateQuestion(id, current.version, {
    text: data.text,
    tags,
    version: current.version + 1,
    updatedAt: at,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Question was changed by someone else");
  await store.addRevision({
    entity: "kompas_question",
    entityId: id,
    version: updated.version,
    before,
    after: snapshotOf(updated),
    changedBy: user.id,
    changedAt: at,
  });
  return questionDto(updated);
}

export async function listQuestionRevisions(
  store: ContentStore,
  actor: CurrentUser | null,
  id: string,
): Promise<StoredRevision[]> {
  requireAdmin(requireUser(actor));
  return (await store.listRevisions("kompas_question", id)).sort((a, b) => b.version - a.version);
}

/** Restores the state before the given revision – as a new revision, history is never rewritten. */
export async function revertQuestion(
  store: ContentStore,
  actor: CurrentUser | null,
  revisionId: string,
  at: Date = new Date(),
): Promise<QuestionDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const revision = await store.findRevision(revisionId);
  if (!revision || revision.entity !== "kompas_question" || !revision.before) {
    throw new ApiError("NOT_FOUND", "Revision not found");
  }
  const current = await store.findQuestion(revision.entityId);
  if (!current) throw new ApiError("NOT_FOUND", "Question not found");
  return updateQuestion(
    store,
    user,
    revision.entityId,
    {
      ...(revision.before as { text: string; tags: string[] }),
      expectedVersion: current.version,
    },
    at,
  );
}
