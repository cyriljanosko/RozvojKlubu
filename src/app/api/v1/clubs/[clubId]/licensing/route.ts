import { connection } from "next/server";

import { ApiError } from "@/server/api/errors";
import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { licensingDeps } from "@/server/clubs/deps";
import { getLicensing, saveLicensing } from "@/server/services/licensing.service";
import { seasonFromSlug } from "@/server/services/season";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/licensing">;

/** GET /api/v1/clubs/:clubId/licensing?season=2026-2027 – licensing evaluation of a season
 *  (default: current season, else the latest with Sportnet data). Management, mentor, coach, admin_sfz. */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const slug = new URL(request.url).searchParams.get("season");
  const season = slug === null ? null : seasonFromSlug(slug);
  if (slug !== null && !season)
    throw new ApiError("BAD_REQUEST", "Season must look like 2026-2027");
  const view = await getLicensing(
    licensingDeps,
    await getCurrentUser(request.headers),
    clubId,
    season,
  );
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});

/** PUT – management, mentor or admin_sfz. Body: { season: "2026/2027", inputs, expectedVersion } */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await saveLicensing(
    licensingDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(view);
});
