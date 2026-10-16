import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { getClubOverview } from "@/server/services/clubs.service";
import { seasonFromSlug } from "@/server/services/season";
import { ApiError } from "@/server/api/errors";

/** GET /api/v1/clubs/:clubId?season=2026-2027 – club overview for members and admin_sfz. */
export const GET = apiHandler<RouteContext<"/api/v1/clubs/[clubId]">>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const slug = new URL(request.url).searchParams.get("season");
  const season = slug === null ? undefined : seasonFromSlug(slug);
  if (season === null) throw new ApiError("BAD_REQUEST", "Invalid season");
  const overview = await getClubOverview(
    clubDeps,
    await getCurrentUser(request.headers),
    clubId,
    season,
  );
  return ok(overview, { headers: { "Cache-Control": "no-store" } });
});
