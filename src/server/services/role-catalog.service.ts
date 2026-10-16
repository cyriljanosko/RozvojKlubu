import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { RoleCatalogDoc } from "@/server/db/types";
import { requireAdmin } from "@/server/services/club-access";
import type { StoredRevision } from "@/server/services/content.service";
import type { RevisionStore } from "@/server/services/methodology.service";
import { roleCatalogSchema, type RoleCatalog } from "@/server/services/role-catalog.schema";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/** Role catalog as managed content (ADR 0010): read by signed-in users, edited by admin_sfz. */
export interface RoleCatalogStore {
  /** inserts only when no catalog exists yet; true when inserted */
  insertCatalogIfMissing: (doc: RoleCatalogDoc) => Promise<boolean>;
  findCatalog: () => Promise<RoleCatalogDoc | null>;
  updateCatalog: (
    expectedVersion: number,
    changes: Pick<RoleCatalogDoc, "content" | "version" | "updatedAt" | "updatedBy">,
  ) => Promise<RoleCatalogDoc | null>;
}

export interface RoleCatalogDto {
  version: number;
  updatedAt: Date;
  content: RoleCatalog;
}

const toDto = (doc: RoleCatalogDoc): RoleCatalogDto => ({
  version: doc.version,
  updatedAt: doc.updatedAt,
  content: roleCatalogSchema.parse(doc.content),
});

export function buildRoleCatalogSeed(file: unknown, at: Date): RoleCatalogDoc {
  return {
    key: "roles",
    content: roleCatalogSchema.parse(file) as unknown as Record<string, unknown>,
    version: 1,
    updatedAt: at,
    updatedBy: "seed",
  };
}

export async function seedRoleCatalog(
  store: RoleCatalogStore,
  actor: CurrentUser | null,
  file: unknown,
  at: Date = new Date(),
): Promise<number> {
  requireAdmin(requireUser(actor));
  return (await store.insertCatalogIfMissing(buildRoleCatalogSeed(file, at))) ? 1 : 0;
}

/** null before the catalog is seeded. */
export async function getRoleCatalog(
  store: Pick<RoleCatalogStore, "findCatalog">,
  actor: CurrentUser | null,
): Promise<RoleCatalogDto | null> {
  requireUser(actor);
  const doc = await store.findCatalog();
  return doc ? toDto(doc) : null;
}

export const updateRoleCatalogSchema = z.object({
  content: roleCatalogSchema,
  expectedVersion: z.number().int().positive(),
});

export async function updateRoleCatalog(
  store: RoleCatalogStore & RevisionStore,
  actor: CurrentUser | null,
  input: unknown,
  at: Date = new Date(),
): Promise<RoleCatalogDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const data = updateRoleCatalogSchema.parse(input);
  const current = await store.findCatalog();
  if (!current) throw new ApiError("NOT_FOUND", "Role catalog not found");
  if (current.version !== data.expectedVersion) {
    throw new ApiError("CONFLICT", "Role catalog was changed by someone else");
  }
  const before = structuredClone(current.content);
  const next = data.content as unknown as Record<string, unknown>;
  if (JSON.stringify(before) === JSON.stringify(next)) return toDto(current);

  const updated = await store.updateCatalog(current.version, {
    content: next,
    version: current.version + 1,
    updatedAt: at,
    updatedBy: user.id,
  });
  if (!updated) throw new ApiError("CONFLICT", "Role catalog was changed by someone else");
  await store.addRevision({
    entity: "role_catalog",
    entityId: "roles",
    version: updated.version,
    before: { content: before },
    after: { content: updated.content },
    changedBy: user.id,
    changedAt: at,
  });
  return toDto(updated);
}

export async function listRoleCatalogRevisions(
  store: RevisionStore,
  actor: CurrentUser | null,
): Promise<Omit<StoredRevision, "before" | "after">[]> {
  requireAdmin(requireUser(actor));
  return (await store.listRevisions("role_catalog", "roles"))
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

export async function revertRoleCatalog(
  store: RoleCatalogStore & RevisionStore,
  actor: CurrentUser | null,
  revisionId: string,
  at: Date = new Date(),
): Promise<RoleCatalogDto> {
  const user = requireUser(actor);
  requireAdmin(user);
  const revision = await store.findRevision(revisionId);
  if (!revision || revision.entity !== "role_catalog" || !revision.before) {
    throw new ApiError("NOT_FOUND", "Revision not found");
  }
  const current = await store.findCatalog();
  if (!current) throw new ApiError("NOT_FOUND", "Role catalog not found");
  return updateRoleCatalog(
    store,
    user,
    {
      content: (revision.before as { content: unknown }).content,
      expectedVersion: current.version,
    },
    at,
  );
}
