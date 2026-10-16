import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listQuestionRevisions } from "@/server/services/content.service";

/** GET /api/v1/kompas/questions/:questionId/revisions – change history, admin_sfz. */
export const GET = apiHandler<RouteContext<"/api/v1/kompas/questions/[questionId]/revisions">>(
  async (request, context) => {
    await connection();
    const { questionId } = await context.params;
    const revisions = await listQuestionRevisions(
      mongoContentStore,
      await getCurrentUser(request.headers),
      questionId,
    );
    return ok(revisions, { headers: { "Cache-Control": "no-store" } });
  },
);
