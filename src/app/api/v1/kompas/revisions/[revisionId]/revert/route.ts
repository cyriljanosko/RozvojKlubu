import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { revertQuestion } from "@/server/services/content.service";

/** POST /api/v1/kompas/revisions/:revisionId/revert – restore the state before a change, admin_sfz. */
export const POST = apiHandler<RouteContext<"/api/v1/kompas/revisions/[revisionId]/revert">>(
  async (request, context) => {
    await connection();
    const { revisionId } = await context.params;
    const question = await revertQuestion(
      mongoContentStore,
      await getCurrentUser(request.headers),
      revisionId,
    );
    return ok(question);
  },
);
