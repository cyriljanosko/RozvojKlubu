import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoPracticeStore } from "@/server/db/content.store";
import { revertPractice } from "@/server/services/practice.service";

/** POST /api/v1/practice/revisions/:revisionId/revert – restore Practice, admin_sfz. */
export const POST = apiHandler<RouteContext<"/api/v1/practice/revisions/[revisionId]/revert">>(
  async (request, context) => {
    await connection();
    const { revisionId } = await context.params;
    const practice = await revertPractice(
      { ...mongoPracticeStore, ...mongoContentStore },
      await getCurrentUser(request.headers),
      revisionId,
    );
    return ok(practice);
  },
);
