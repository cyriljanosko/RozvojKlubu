import { connection } from "next/server";

import { apiHandler } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { removeClubMember } from "@/server/services/clubs.service";

/** DELETE /api/v1/clubs/:clubId/members/:membershipId – admin_sfz only. */
export const DELETE = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/members/[membershipId]">>(
  async (request, context) => {
    await connection();
    const { clubId, membershipId } = await context.params;
    await removeClubMember(clubDeps, await getCurrentUser(request.headers), clubId, membershipId);
    return new Response(null, { status: 204 });
  },
);
