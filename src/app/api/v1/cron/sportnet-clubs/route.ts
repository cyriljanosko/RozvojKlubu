import { timingSafeEqual } from "node:crypto";

import { connection } from "next/server";

import { ApiError } from "@/server/api/errors";
import { apiHandler, ok } from "@/server/api/http";
import { syncRunDeps } from "@/server/clubs/deps";
import { runRecordedClubSync } from "@/server/services/sync-runs.service";

/**
 * GET /api/v1/cron/sportnet-clubs – nightly sync of clubs from sportnet.online (Vercel Cron,
 * `vercel.json`, ADR 0029). Vercel sends `Authorization: Bearer $CRON_SECRET`; without the
 * secret configured the route refuses every call. Every run is recorded in `sync_runs` (ADR 0030).
 */
export const maxDuration = 300;

function isCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const GET = apiHandler(async (request) => {
  await connection();
  if (!isCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    throw new ApiError("UNAUTHORIZED", "Cron secret missing or wrong");
  }
  const result = await runRecordedClubSync(syncRunDeps, "cron");
  // counts only, no club or personal data
  console.info("sportnet club sync", JSON.stringify(result));
  return ok(result);
});
