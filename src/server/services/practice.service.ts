import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { AreaPracticeDoc } from "@/server/db/types";
import { requireAdmin } from "@/server/services/club-access";
import type { StoredRevision } from "@/server/services/content.service";
import type { RevisionStore } from "@/server/services/methodology.service";
import {
  practiceContentSchema,
  practiceFileSchema,
  type PracticeContent,
} from "@/server/services/practice.schema";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Practice of an area as one validated document (roles share templates and mentor modules).
 * Read-only for signed-in users in the pilot; progress of a club is Stupeň II (F6).
 */
export interface PracticeStore {
  insertMissingPractice: (docs: AreaPracticeDoc[]) => Promise<number>;
  findPractice: (area: number) => Promise<AreaPracticeDoc | null>;
  listPracticeAreas: () => Promise<number[]>;
  updatePractice: (
    area: number,
    expectedVersion: number,
    changes: Pick<
      AreaPracticeDoc,
      "content" | "validAsOf" | "reviewedAt" | "version" | "updatedAt" | "updatedBy"
    >,
  ) => Promise<AreaPracticeDoc | null>;
}

export interface PracticeDto {
  area: number;
  version: number;
  updatedAt: Date;
  validAsOf: string | null;
  reviewedAt: string | null;
  content: PracticeContent;
}

const toDto = (doc: AreaPracticeDoc): PracticeDto => ({
  area: doc.area,
  version: doc.version,
  updatedAt: doc.updatedAt,
  validAsOf: doc.validAsOf,
  reviewedAt: doc.reviewedAt,
  content: practiceContentSchema.parse(doc.content),
});

const areaNumber = (area: number) => {
  if (!Number.isInteger(area) || area < 1 || area > 11) {
    throw new ApiError("BAD_REQUEST", "Invalid area");
  }
  return area;
};

export function buildPracticeSeed(files: unknown[], at: Date): AreaPracticeDoc[] {
  return files.map((raw) => {
    const file = practiceFileSchema.parse(raw);
    const content = practiceContentSchema.parse({
      roles: file.roles,
      templates: file.templates,
      mentorModules: file.mentorModules,
    });
    return {
      area: file.area,
      content,
      validAsOf: file.validAsOf,
      reviewedAt: file.reviewedAt,
      version: 1,
      updatedAt: at,
      updatedBy: "seed",
    };
  });
}

export async function seedPractice(
  store: PracticeStore,
  actor: CurrentUser | null,
  files: unknown[],
  at: Date = new Date(),
): Promise<number> {
  requireAdmin(requireUser(actor));
  return store.insertMissingPractice(buildPracticeSeed(files, at));
}

export async function listPracticeAreas(
  store: PracticeStore,
  actor: CurrentUser | null,
): Promise<number[]> {
  void actor; // public read, no sign-in needed (ADR 0011)
  return (await store.listPracticeAreas()).sort((a, b) => a - b);
}

/** null when the area has no practice yet (only areas 3 and 4 in the pilot). */
export async function getPractice(
  store: PracticeStore,
  actor: CurrentUser | null,
  area: number,
): Promise<PracticeDto | null> {
  void actor; // public read, no sign-in needed (ADR 0011)
  const doc = await store.findPractice(areaNumber(area));
  return doc ? toDto(doc) : null;
}

const dateOrNull = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

export const updatePracticeSchema = z.object({
  content: practiceContentSchema,
  validAsOf: dateOrNull,
  reviewedAt: dateOrNull,
  expectedVersion: z.number().int().positive(),
});

const snapshotOf = (d: Pick<AreaPracticeDoc, "content" | "validAsOf" | "reviewedAt">) => ({
  content: d.content,
  validAsOf: d.validAsOf,
  reviewedAt: d.reviewedAt,
});

export async function updatePractice(
  store: PracticeStore & RevisionStore,
  actor: CurrentUser | null,
  area: number,
  input: unknown,
  at: Date = new Date(),
): Promise<PracticeDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const data = updatePracticeSchema.parse(input);
  const current = await store.findPractice(areaNumber(area));
  if (!current) throw new ApiError("NOT_FOUND", "Practice not found");
  if (current.version !== data.expectedVersion) {
    throw new ApiError("CONFLICT", "Practice was changed by someone else");
  }
  const before = structuredClone(snapshotOf(current));
  const next = { content: data.content, validAsOf: data.validAsOf, reviewedAt: data.reviewedAt };
  if (JSON.stringify(before) === JSON.stringify(next)) return toDto(current);

  const updated = await store.updatePractice(area, current.version, {
    ...next,
    version: current.version + 1,
    updatedAt: at,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Practice was changed by someone else");
  await store.addRevision({
    entity: "area_practice",
    entityId: String(area),
    version: updated.version,
    before,
    after: snapshotOf(updated),
    changedBy: user.id,
    changedAt: at,
  });
  return toDto(updated);
}

export async function listPracticeRevisions(
  store: RevisionStore,
  actor: CurrentUser | null,
  area: number,
): Promise<Omit<StoredRevision, "before" | "after">[]> {
  requireAdmin(requireUser(actor));
  // history list without the (large) document bodies
  return (await store.listRevisions("area_practice", String(areaNumber(area))))
    .sort((a, b) => b.version - a.version)
    .map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      version: r.version,
      changedBy: r.changedBy,
      changedAt: r.changedAt,
    }));
}

export async function revertPractice(
  store: PracticeStore & RevisionStore,
  actor: CurrentUser | null,
  revisionId: string,
  at: Date = new Date(),
): Promise<PracticeDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const revision = await store.findRevision(revisionId);
  if (!revision || revision.entity !== "area_practice" || !revision.before) {
    throw new ApiError("NOT_FOUND", "Revision not found");
  }
  const area = Number(revision.entityId);
  const current = await store.findPractice(area);
  if (!current) throw new ApiError("NOT_FOUND", "Practice not found");
  return updatePractice(
    store,
    user,
    area,
    { ...revision.before, expectedVersion: current.version },
    at,
  );
}
