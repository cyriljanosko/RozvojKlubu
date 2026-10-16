import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoSectionStore } from "@/server/db/content.store";
import { updateSection } from "@/server/services/methodology.service";

/** PATCH /api/v1/areas/:area/methodology/:key – admin_sfz.
 *  Body: { title, body, validAsOf, reviewedAt, expectedVersion } */
export const PATCH = apiHandler<RouteContext<"/api/v1/areas/[area]/methodology/[key]">>(
  async (request, context) => {
    await connection();
    const { area, key } = await context.params;
    const updated = await updateSection(
      { ...mongoSectionStore, ...mongoContentStore },
      await getCurrentUser(request.headers),
      Number(area),
      key,
      await request.json(),
    );
    return ok(updated);
  },
);
