import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { setPrepTaskDone } from "@/server/services/mentor-visit.service";

/** PATCH – the club ticks the task before the visit (MC). Body: { done, expectedVersion } */
export const PATCH = apiHandler<
  RouteContext<"/api/v1/clubs/[clubId]/mentor-visits/[visitId]/prep">
>(async (request, context) => {
  await connection();
  const { clubId, visitId } = await context.params;
  const visit = await setPrepTaskDone(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    visitId,
    await request.json(),
  );
  return ok(visit);
});
