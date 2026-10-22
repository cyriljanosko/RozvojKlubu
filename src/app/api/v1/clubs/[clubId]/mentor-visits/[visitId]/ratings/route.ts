import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { rateMentorVisit } from "@/server/services/mentor-visit.service";

/** PATCH – the mentor rates the task before the visit and the agreed steps (MC).
 *  Body: { prep?: "done"|"partial"|"not"|null, actions: [{ id, rating }], expectedVersion } */
export const PATCH = apiHandler<
  RouteContext<"/api/v1/clubs/[clubId]/mentor-visits/[visitId]/ratings">
>(async (request, context) => {
  await connection();
  const { clubId, visitId } = await context.params;
  const visit = await rateMentorVisit(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    visitId,
    await request.json(),
  );
  return ok(visit);
});
