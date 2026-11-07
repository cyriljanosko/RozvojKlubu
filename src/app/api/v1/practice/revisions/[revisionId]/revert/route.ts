import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { revertPractice } from "@/server/services/practice.service";
import { practiceEditStore } from "@/server/content/deps";

/** POST /api/v1/practice/revisions/:revisionId/revert – restore Practice, admin_sfz. */
export const POST = apiHandler<RouteContext<"/api/v1/practice/revisions/[revisionId]/revert">>(
  async (request, context) => {
    await connection();
    const { revisionId } = await context.params;
    const practice = await revertPractice(
      practiceEditStore,
      await getCurrentUser(request.headers),
      revisionId,
    );
    return ok(practice);
  },
);
