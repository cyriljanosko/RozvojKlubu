import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { sendMentorVisit } from "@/server/services/mentor-visit.service";

/** POST – send a draft to the club (mentor or admin_sfz). Body: { expectedVersion } */
export const POST = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/mentor-visits/[visitId]/send">>(
  async (request, context) => {
    await connection();
    const { clubId, visitId } = await context.params;
    const visit = await sendMentorVisit(
      visitDeps,
      await getCurrentUser(request.headers),
      clubId,
      visitId,
      await request.json(),
    );
    return ok(visit);
  },
);
