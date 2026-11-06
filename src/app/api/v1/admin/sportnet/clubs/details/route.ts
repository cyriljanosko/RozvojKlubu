import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { clubImportDeps } from "@/server/clubs/deps";
import { fillClubDetails } from "@/server/services/club-import.service";

/**
 * POST /api/v1/admin/sportnet/clubs/details – admin_sfz reads union, region and the legal entity
 * (IČO) of imported clubs from their Sportnet profiles, at most `limit` clubs per call (ADR 0028).
 * Body `{ apply?: boolean, limit?: number }`; without `apply: true` it is a dry-run of the batch.
 */
export const maxDuration = 300;

export const POST = apiHandler(async (request) => {
  await connection();
  const body = await request.json().catch(() => ({}));
  return ok(await fillClubDetails(clubImportDeps, await getCurrentUser(request.headers), body));
});
