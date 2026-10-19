import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { licensingDeps } from "@/server/clubs/deps";
import { closeLicensing, listLicensingSubmissions } from "@/server/services/licensing.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/licensing/submissions">;

/** GET – closed seasons of the club (management, mentor, coach, admin_sfz). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const list = await listLicensingSubmissions(
    licensingDeps,
    await getCurrentUser(request.headers),
    clubId,
  );
  return ok(list, { headers: { "Cache-Control": "no-store" } });
});

/** POST – close the season as a frozen copy (management, mentor, admin_sfz). Body: { season, expectedVersion } */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const created = await closeLicensing(
    licensingDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(created, { status: 201 });
});
