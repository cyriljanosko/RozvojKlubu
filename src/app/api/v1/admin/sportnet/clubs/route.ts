import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { clubImportDeps } from "@/server/clubs/deps";
import { importSportnetClubs } from "@/server/services/club-import.service";

/**
 * POST /api/v1/admin/sportnet/clubs – admin_sfz imports every active club from sportnet.online
 * (ADR 0028). Body `{ apply?: boolean }`; without `apply: true` it is a dry-run.
 */
export const POST = apiHandler(async (request) => {
  await connection();
  const body = await request.json().catch(() => ({}));
  return ok(await importSportnetClubs(clubImportDeps, await getCurrentUser(request.headers), body));
});
