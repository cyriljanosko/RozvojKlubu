import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { updateArea } from "@/server/services/content.service";
import { contentEditStore } from "@/server/content/deps";

type Ctx = RouteContext<"/api/v1/areas/[area]">;

/** PUT /api/v1/areas/:area – admin_sfz renames an area. Body: { name, shortName, description, expectedVersion } */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { area } = await context.params;
  const updated = await updateArea(
    contentEditStore,
    await getCurrentUser(request.headers),
    Number(area),
    await request.json(),
  );
  return ok(updated);
});
