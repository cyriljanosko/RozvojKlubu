import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { kompasDeps } from "@/server/clubs/deps";
import { getKompas, saveKompasAnswers } from "@/server/services/kompas.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/kompas">;

/** GET /api/v1/clubs/:clubId/kompas – questions with validity, answers and result
 *  (club management and admin_sfz edit, coaches read). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await getKompas(kompasDeps, await getCurrentUser(request.headers), clubId);
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});

/** PUT /api/v1/clubs/:clubId/kompas – management or admin_sfz. Body: { answers, expectedVersion } */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await saveKompasAnswers(
    kompasDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(view);
});
