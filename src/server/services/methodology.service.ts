import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { AreaSectionDoc, SectionKind } from "@/server/db/types";
import { requireAdmin } from "@/server/services/club-access";
import type { ContentStore, StoredRevision } from "@/server/services/content.service";
import type { MethodologyFile } from "@/server/services/methodology-file";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Methodology (and later Practice) sections of an area as Markdown.
 * Read: every signed-in user. Edit: admin_sfz, versioned, with revisions (like Kompas questions).
 */
export interface SectionStore {
  /** Inserts sections that do not exist yet; never overwrites edits. */
  insertMissingSections: (docs: AreaSectionDoc[]) => Promise<number>;
  listSections: (area: number, kind: SectionKind) => Promise<AreaSectionDoc[]>;
  findSection: (area: number, kind: SectionKind, key: string) => Promise<AreaSectionDoc | null>;
  /** Atomic update guarded by `expectedVersion`; null on a version conflict. */
  updateSection: (
    area: number,
    kind: SectionKind,
    key: string,
    expectedVersion: number,
    changes: Pick<
      AreaSectionDoc,
      "title" | "body" | "validAsOf" | "reviewedAt" | "version" | "updatedAt" | "updatedBy"
    >,
  ) => Promise<AreaSectionDoc | null>;
}

export type RevisionStore = Pick<ContentStore, "addRevision" | "listRevisions" | "findRevision">;

export type SectionDto = Omit<AreaSectionDoc, "_id" | "updatedBy">;

const toDto = (s: AreaSectionDoc): SectionDto => {
  const copy: Partial<AreaSectionDoc> = { ...s };
  delete copy._id;
  delete copy.updatedBy;
  return copy as SectionDto;
};

export const sectionId = (area: number, kind: SectionKind, key: string) => `${area}.${kind}.${key}`;

const areaNumber = (area: number) => {
  if (!Number.isInteger(area) || area < 1 || area > 11) {
    throw new ApiError("BAD_REQUEST", "Invalid area");
  }
  return area;
};

export function buildMethodologySeed(files: MethodologyFile[], at: Date): AreaSectionDoc[] {
  return files.flatMap((f) =>
    f.sections.map((s) => ({
      area: f.area,
      kind: "methodology" as const,
      key: s.key,
      order: s.order,
      title: s.title,
      body: s.body,
      validAsOf: f.validAsOf,
      reviewedAt: f.reviewedAt,
      version: 1,
      updatedAt: at,
      updatedBy: "seed",
    })),
  );
}

export async function seedMethodology(
  store: SectionStore,
  actor: CurrentUser | null,
  files: MethodologyFile[],
  at: Date = new Date(),
): Promise<number> {
  requireAdmin(requireUser(actor));
  return store.insertMissingSections(buildMethodologySeed(files, at));
}

export async function listMethodology(
  store: SectionStore,
  actor: CurrentUser | null,
  area: number,
): Promise<SectionDto[]> {
  void actor; // public read, no sign-in needed (ADR 0011)
  return (await store.listSections(areaNumber(area), "methodology"))
    .sort((a, b) => a.order - b.order)
    .map(toDto);
}

const dateOrNull = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

export const updateSectionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  // <textarea> submits CRLF; content is stored with LF only
  body: z
    .string()
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1).max(100_000)),
  validAsOf: dateOrNull,
  reviewedAt: dateOrNull,
  expectedVersion: z.number().int().positive(),
});

const snapshotOf = (s: AreaSectionDoc) => ({
  title: s.title,
  body: s.body,
  validAsOf: s.validAsOf,
  reviewedAt: s.reviewedAt,
});

export async function updateSection(
  store: SectionStore & RevisionStore,
  actor: CurrentUser | null,
  area: number,
  key: string,
  input: unknown,
  at: Date = new Date(),
): Promise<SectionDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const data = updateSectionSchema.parse(input);
  const current = await store.findSection(areaNumber(area), "methodology", key);
  if (!current) throw new ApiError("NOT_FOUND", "Section not found");
  if (current.version !== data.expectedVersion) {
    throw new ApiError("CONFLICT", "Section was changed by someone else");
  }
  const before = snapshotOf(current);
  const next = {
    title: data.title,
    body: data.body,
    validAsOf: data.validAsOf,
    reviewedAt: data.reviewedAt,
  };
  if (JSON.stringify(before) === JSON.stringify(next)) return toDto(current);

  const updated = await store.updateSection(area, "methodology", key, current.version, {
    ...next,
    version: current.version + 1,
    updatedAt: at,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Section was changed by someone else");
  await store.addRevision({
    entity: "area_section",
    entityId: sectionId(area, "methodology", key),
    version: updated.version,
    before,
    after: snapshotOf(updated),
    changedBy: user.id,
    changedAt: at,
  });
  return toDto(updated);
}

export async function listSectionRevisions(
  store: RevisionStore,
  actor: CurrentUser | null,
  area: number,
  key: string,
): Promise<StoredRevision[]> {
  requireAdmin(requireUser(actor));
  return (await store.listRevisions("area_section", sectionId(area, "methodology", key))).sort(
    (a, b) => b.version - a.version,
  );
}

/** Restores the state before the given revision as a new revision. */
export async function revertSection(
  store: SectionStore & RevisionStore,
  actor: CurrentUser | null,
  revisionId: string,
  at: Date = new Date(),
): Promise<SectionDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const revision = await store.findRevision(revisionId);
  if (!revision || revision.entity !== "area_section" || !revision.before) {
    throw new ApiError("NOT_FOUND", "Revision not found");
  }
  const [areaPart, , ...keyParts] = revision.entityId.split(".");
  const area = Number(areaPart);
  const key = keyParts.join(".");
  const current = await store.findSection(area, "methodology", key);
  if (!current) throw new ApiError("NOT_FOUND", "Section not found");
  return updateSection(
    store,
    user,
    area,
    key,
    { ...revision.before, expectedVersion: current.version },
    at,
  );
}
