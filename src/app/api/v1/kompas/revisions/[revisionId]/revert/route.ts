import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { revertQuestion } from "@/server/services/content.service";
import { contentEditStore } from "@/server/content/deps";

/** POST /api/v1/kompas/revisions/:revisionId/revert – restore the state before a change, admin_sfz. */
export const POST = apiHandler<RouteContext<"/api/v1/kompas/revisions/[revisionId]/revert">>(
  async (request, context) => {
    await connection();
    const { revisionId } = await context.params;
    const question = await revertQuestion(
      contentEditStore,
      await getCurrentUser(request.headers),
      revisionId,
    );
    return ok(question);
  },
);
