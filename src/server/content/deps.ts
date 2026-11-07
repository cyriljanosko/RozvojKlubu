import "server-only";

import { mongoAuditLog } from "@/server/db/audit.store";
import {
  mongoContentStore,
  mongoPracticeStore,
  mongoRoleCatalogStore,
  mongoSectionStore,
} from "@/server/db/content.store";

/** Stores for editing shared content (admin_sfz): every change also goes to the audit log (ADR 0034). */
export const contentEditStore = { ...mongoContentStore, audit: mongoAuditLog };
export const sectionEditStore = {
  ...mongoSectionStore,
  ...mongoContentStore,
  audit: mongoAuditLog,
};
export const practiceEditStore = {
  ...mongoPracticeStore,
  ...mongoContentStore,
  audit: mongoAuditLog,
};
export const roleCatalogEditStore = {
  ...mongoRoleCatalogStore,
  ...mongoContentStore,
  audit: mongoAuditLog,
};
