import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listSectionRevisions } from "@/server/services/methodology.service";

/** GET /api/v1/areas/:area/methodology/:key/revisions – change history, admin_sfz. */
export const GET = apiHandler<RouteContext<"/api/v1/areas/[area]/methodology/[key]/revisions">>(
  async (request, context) => {
    await connection();
    const { area, key } = await context.params;
    const revisions = await listSectionRevisions(
      mongoContentStore,
      await getCurrentUser(request.headers),
      Number(area),
      key,
    );
    return ok(revisions, { headers: { "Cache-Control": "no-store" } });
  },
);
