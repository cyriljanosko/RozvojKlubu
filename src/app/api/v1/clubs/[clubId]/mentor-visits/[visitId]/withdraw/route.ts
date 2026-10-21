import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { withdrawMentorVisit } from "@/server/services/mentor-visit.service";

/** POST – withdraw a visit (it stays in the history) (mentor or admin_sfz). Body: { expectedVersion } */
export const POST = apiHandler<
  RouteContext<"/api/v1/clubs/[clubId]/mentor-visits/[visitId]/withdraw">
>(async (request, context) => {
  await connection();
  const { clubId, visitId } = await context.params;
  const visit = await withdrawMentorVisit(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    visitId,
    await request.json(),
  );
  return ok(visit);
});
