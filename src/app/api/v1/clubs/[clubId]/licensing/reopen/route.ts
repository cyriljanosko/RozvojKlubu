import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { licensingDeps } from "@/server/clubs/deps";
import { reopenLicensing } from "@/server/services/licensing.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/licensing/reopen">;

/** POST – reopen a closed season (admin_sfz only, ADR 0008); the closing stays in the history.
 *  Body: { season: "2026/2027" } */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const reopened = await reopenLicensing(
    licensingDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(reopened);
});
