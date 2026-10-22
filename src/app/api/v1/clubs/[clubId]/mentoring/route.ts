import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mentoringDeps } from "@/server/clubs/deps";
import { getClubMentoring } from "@/server/services/club-mentoring.service";

/** GET ?season= – the club's mentoring cycle (MC): intro, focus, closings; current season by default. */
export const GET = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/mentoring">>(
  async (request, context) => {
    await connection();
    const { clubId } = await context.params;
    const view = await getClubMentoring(
      mentoringDeps,
      await getCurrentUser(request.headers),
      clubId,
      new URL(request.url).searchParams.get("season"),
    );
    return ok(view, { headers: { "Cache-Control": "no-store" } });
  },
);
