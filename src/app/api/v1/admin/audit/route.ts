import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { auditReadDeps } from "@/server/clubs/deps";
import { listAuditLog } from "@/server/services/audit.service";

/**
 * GET /api/v1/admin/audit?clubId=&actorId=&action=&from=&to=&page= – audit log of admin and access
 * changes, newest first, 50 per page (ADR 0034). Only admin_sfz.
 */
export const GET = apiHandler(async (request) => {
  await connection();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { entries, page } = await listAuditLog(
    auditReadDeps,
    await getCurrentUser(request.headers),
    params,
  );
  return ok({ entries }, { meta: page, headers: { "Cache-Control": "no-store" } });
});
