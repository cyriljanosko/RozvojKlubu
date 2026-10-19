import { connection } from "next/server";

import { ApiError } from "@/server/api/errors";
import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoPracticeStore } from "@/server/db/content.store";
import { getPractice, updatePractice } from "@/server/services/practice.service";

type Ctx = RouteContext<"/api/v1/areas/[area]/practice">;

/** GET /api/v1/areas/:area/practice – Practice of an area (signed-in users); 404 when none. */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { area } = await context.params;
  const practice = await getPractice(
    mongoPracticeStore,
    await getCurrentUser(request.headers),
    Number(area),
  );
  if (!practice) throw new ApiError("NOT_FOUND", "Practice not found");
  return ok(practice, { headers: { "Cache-Control": "no-store" } });
});

/** PUT /api/v1/areas/:area/practice – admin_sfz. Body: { content, validAsOf, reviewedAt, expectedVersion } */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { area } = await context.params;
  const updated = await updatePractice(
    { ...mongoPracticeStore, ...mongoContentStore },
    await getCurrentUser(request.headers),
    Number(area),
    await request.json(),
  );
  return ok(updated);
});
