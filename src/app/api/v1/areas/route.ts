import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listAreas } from "@/server/services/content.service";

/** GET /api/v1/areas – the 11 development areas (public, ADR 0011). */
export const GET = apiHandler(async (request) => {
  await connection();
  const areas = await listAreas(mongoContentStore, await getCurrentUser(request.headers));
  return ok(areas, { headers: { "Cache-Control": "no-store" } });
});
