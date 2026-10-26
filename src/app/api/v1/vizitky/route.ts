import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { rankingsDeps } from "@/server/clubs/deps";
import { listVizitky } from "@/server/services/vizitky.service";

/** GET – public list of club Vizitky with the rankings data (no sign-in needed; ADR 0015):
 *  ratings only for clubs that consented; `viewer` says whose full position the user may see. */
export const GET = apiHandler(async (request) => {
  await connection();
  const view = await listVizitky(rankingsDeps, await getCurrentUser(request.headers));
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});
