import { connection } from "next/server";
import { z } from "zod";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { networkDeps } from "@/server/clubs/deps";
import { getNetwork } from "@/server/services/network.service";

const querySchema = z.object({
  map: z.enum(["academy", "club"]).default("academy"),
  club: z.string().min(1).max(200).optional(),
});

/** GET /api/v1/analytics/network?map=academy|club&club= – nodes and edges of the network graph
 *  (DA-d): the Academy map for every signed-in user, a club map within the analysis scope. */
export const GET = apiHandler(async (request) => {
  await connection();
  const { map, club } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const view = await getNetwork(networkDeps, await getCurrentUser(request.headers), {
    map,
    clubId: club ?? null,
  });
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});
