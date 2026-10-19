import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoSectionStore } from "@/server/db/content.store";
import { revertSection } from "@/server/services/methodology.service";

/** POST /api/v1/methodology/revisions/:revisionId/revert – restore a section, admin_sfz. */
export const POST = apiHandler<RouteContext<"/api/v1/methodology/revisions/[revisionId]/revert">>(
  async (request, context) => {
    await connection();
    const { revisionId } = await context.params;
    const section = await revertSection(
      { ...mongoSectionStore, ...mongoContentStore },
      await getCurrentUser(request.headers),
      revisionId,
    );
    return ok(section);
  },
);
