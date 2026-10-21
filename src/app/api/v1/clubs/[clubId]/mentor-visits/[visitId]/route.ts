import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { getMentorVisit, updateMentorVisit } from "@/server/services/mentor-visit.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/mentor-visits/[visitId]">;

/** GET – one visit (the club only when sent). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, visitId } = await context.params;
  const visit = await getMentorVisit(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    visitId,
  );
  return ok(visit, { headers: { "Cache-Control": "no-store" } });
});

/** PATCH – edit the content (mentor or admin_sfz). Body: visit fields + expectedVersion */
export const PATCH = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, visitId } = await context.params;
  const visit = await updateMentorVisit(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    visitId,
    await request.json(),
  );
  return ok(visit);
});
