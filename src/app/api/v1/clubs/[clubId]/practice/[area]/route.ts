import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { progressDeps } from "@/server/clubs/deps";
import {
  getPracticeProgress,
  savePracticeProgress,
} from "@/server/services/practice-progress.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/practice/[area]">;

/** GET /api/v1/clubs/:clubId/practice/:area – the club's progress in the area's Prax this season
 *  (management, coaches and admin_sfz edit, the union mentor reads). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, area } = await context.params;
  const view = await getPracticeProgress(
    progressDeps,
    await getCurrentUser(request.headers),
    clubId,
    Number(area),
  );
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});

/** PUT /api/v1/clubs/:clubId/practice/:area – management, coaches or admin_sfz.
 *  Body: { tasks, steps: [{ stepId, option, done }], expectedVersion } */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, area } = await context.params;
  const view = await savePracticeProgress(
    progressDeps,
    await getCurrentUser(request.headers),
    clubId,
    Number(area),
    await request.json(),
  );
  return ok(view);
});
