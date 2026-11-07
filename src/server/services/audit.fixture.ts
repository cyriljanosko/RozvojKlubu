import type { AuditEntry, AuditLog } from "./audit.service";

/** In-memory audit log for tests: `entries` collects what services record. */
export function memoryAudit(): AuditLog & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    record: async (entry) => {
      entries.push(entry);
    },
  };
}
