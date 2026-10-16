import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { listClubSubmissions, submitKompas } from "@/server/services/kompas-submission.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/kompas/submissions">;

/** GET – submitted versions (management, coach, mentor of the club, admin_sfz). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const list = await listClubSubmissions(
    submissionDeps,
    await getCurrentUser(request.headers),
    clubId,
  );
  return ok(list, { headers: { "Cache-Control": "no-store" } });
});

/** POST – send the saved Kompas to the mentor as a frozen copy. Body: { expectedVersion } */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const created = await submitKompas(
    submissionDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(created, { status: 201 });
});
