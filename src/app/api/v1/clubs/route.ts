import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { listMyClubs } from "@/server/services/clubs.service";

/** GET /api/v1/clubs – clubs the signed-in user may open (admin_sfz: all). */
export const GET = apiHandler(async (request) => {
  await connection();
  const clubs = await listMyClubs(clubDeps, await getCurrentUser(request.headers));
  return ok(clubs, { headers: { "Cache-Control": "no-store" } });
});
