import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { setVisitActionDone } from "@/server/services/mentor-visit.service";

/** PATCH – tick an agreed action (the club, its mentor, admin_sfz). Body: { done, expectedVersion } */
export const PATCH = apiHandler<
  RouteContext<"/api/v1/clubs/[clubId]/mentor-visits/[visitId]/actions/[actionId]">
>(async (request, context) => {
  await connection();
  const { clubId, visitId, actionId } = await context.params;
  const visit = await setVisitActionDone(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    visitId,
    actionId,
    await request.json(),
  );
  return ok(visit);
});
