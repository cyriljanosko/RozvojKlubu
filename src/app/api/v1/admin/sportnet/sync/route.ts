import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { syncRunDeps } from "@/server/clubs/deps";
import { getSportnetSyncStatus, startManualClubSync } from "@/server/services/sync-runs.service";

/**
 * GET  /api/v1/admin/sportnet/sync – state of the club sync: club counts and the last runs.
 * POST /api/v1/admin/sportnet/sync – manual run of the nightly sync, `{ apply?: boolean }`;
 *      without `apply: true` it is a dry-run. Only admin_sfz (ADR 0030).
 */
export const maxDuration = 300;

export const GET = apiHandler(async (request) => {
  await connection();
  return ok(await getSportnetSyncStatus(syncRunDeps, await getCurrentUser(request.headers)));
});

export const POST = apiHandler(async (request) => {
  await connection();
  const body = await request.json().catch(() => ({}));
  return ok(await startManualClubSync(syncRunDeps, await getCurrentUser(request.headers), body));
});
