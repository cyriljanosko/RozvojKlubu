import { z } from "zod";

import type { AuditLogDoc } from "@/server/db/types";
import { requireAdmin } from "@/server/services/club-access";
import type { UserDirectory } from "@/server/services/clubs.service";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Audit log of admin and access changes (ADR 0034). Services record an entry after a successful
 * change; a failed write is logged on the server and never undoes or blocks the change. Entries
 * hold IDs, roles and states only – no names, e-mails or texts.
 */

export const AUDIT_ACTIONS = [
  "user.role.change",
  "club.member.add",
  "club.member.remove",
  "club.member.sportnet",
  "club.rankingConsent.set",
  "licensing.close",
  "licensing.reopen",
  "kompas.submission.confirm",
  "kompas.submission.withdraw",
  "news.publish",
  "news.return",
  "news.hide",
  "news.pin",
  "content.question.update",
  "content.question.revert",
  "content.area.update",
  "content.section.update",
  "content.section.revert",
  "content.practice.update",
  "content.practice.revert",
  "content.roleCatalog.update",
  "content.roleCatalog.revert",
  "sportnet.sync.apply",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = Omit<AuditLogDoc, "_id" | "action"> & { action: AuditAction };
export type StoredAuditEntry = AuditEntry & { id: string };

export interface AuditLog {
  record: (entry: AuditEntry) => Promise<void>;
}

export interface AuditDeps {
  audit: AuditLog;
}

export interface AuditFilter {
  clubId?: string;
  actorId?: string;
  action?: AuditAction;
  from?: Date;
  /** exclusive */
  to?: Date;
}

export interface AuditReader {
  /** newest first */
  list: (
    filter: AuditFilter,
    page: { skip: number; limit: number },
  ) => Promise<{ entries: StoredAuditEntry[]; total: number }>;
}

export interface AuditRecordInput {
  action: AuditAction;
  clubId: string | null;
  target: AuditEntry["target"];
  changes?: AuditEntry["changes"];
  source?: AuditEntry["source"];
  at?: Date;
}

/** Records one change; never throws (ADR 0034, point 5). */
export async function recordAudit(
  deps: AuditDeps,
  actor: { id: string; role?: string | null } | null,
  input: AuditRecordInput,
): Promise<void> {
  const entry: AuditEntry = {
    at: input.at ?? new Date(),
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    source: input.source ?? (actor ? "user" : "cron"),
    action: input.action,
    clubId: input.clubId,
    target: input.target,
    ...(input.changes ? { changes: input.changes } : {}),
  };
  try {
    await deps.audit.record(entry);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.error(`[audit] write failed – ${entry.action} ${entry.target.type} – ${reason}`);
  }
}

export const AUDIT_PAGE_SIZE = 50;

const day = z.iso.date().transform((d) => new Date(`${d}T00:00:00Z`));

export const auditQuerySchema = z.object({
  clubId: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  /** first day included (UTC) */
  from: day.optional(),
  /** last day included (UTC) */
  to: day.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export interface AuditEntryView {
  id: string;
  at: string;
  actorId: string | null;
  /** name (or e-mail) of the actor; "" when the account no longer exists, null for automatic runs */
  actorName: string | null;
  actorRole: string | null;
  source: AuditEntry["source"];
  action: AuditAction;
  clubId: string | null;
  target: AuditEntry["target"];
  changes: NonNullable<AuditEntry["changes"]>;
}

export interface AuditReadDeps {
  audit: AuditReader;
  users: Pick<UserDirectory, "findById">;
}

/** Audit log for admin_sfz, newest first, 50 per page (ADR 0034, point 6). */
export async function listAuditLog(
  deps: AuditReadDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<{
  entries: AuditEntryView[];
  page: { page: number; pageSize: number; total: number; pages: number };
}> {
  const user = requireUser(actor);
  requireAdmin(user);
  const { page, from, to, ...rest } = auditQuerySchema.parse(input ?? {});
  const filter: AuditFilter = {
    ...rest,
    ...(from ? { from } : {}),
    ...(to ? { to: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
  };
  const { entries, total } = await deps.audit.list(filter, {
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    limit: AUDIT_PAGE_SIZE,
  });
  const actorIds = [...new Set(entries.flatMap((e) => (e.actorId ? [e.actorId] : [])))];
  const names = new Map(
    await Promise.all(
      actorIds.map(async (id) => {
        const person = await deps.users.findById(id);
        return [id, person ? person.name || person.email : ""] as const;
      }),
    ),
  );
  return {
    entries: entries.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      actorId: e.actorId,
      actorName: e.actorId ? (names.get(e.actorId) ?? "") : null,
      actorRole: e.actorRole,
      source: e.source,
      action: e.action,
      clubId: e.clubId,
      target: e.target,
      changes: e.changes ?? {},
    })),
    page: {
      page,
      pageSize: AUDIT_PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    },
  };
}
