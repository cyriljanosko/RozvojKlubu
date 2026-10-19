import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listPracticeRevisions } from "@/server/services/practice.service";

/** GET /api/v1/areas/:area/practice/revisions – change history (without bodies), admin_sfz. */
export const GET = apiHandler<RouteContext<"/api/v1/areas/[area]/practice/revisions">>(
  async (request, context) => {
    await connection();
    const { area } = await context.params;
    const revisions = await listPracticeRevisions(
      mongoContentStore,
      await getCurrentUser(request.headers),
      Number(area),
    );
    return ok(revisions, { headers: { "Cache-Control": "no-store" } });
  },
);
