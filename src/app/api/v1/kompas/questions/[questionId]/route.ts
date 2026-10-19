import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { updateQuestion } from "@/server/services/content.service";

/** PATCH /api/v1/kompas/questions/:questionId – admin_sfz. Body: { text, tags, expectedVersion } */
export const PATCH = apiHandler<RouteContext<"/api/v1/kompas/questions/[questionId]">>(
  async (request, context) => {
    await connection();
    const { questionId } = await context.params;
    const updated = await updateQuestion(
      mongoContentStore,
      await getCurrentUser(request.headers),
      questionId,
      await request.json(),
    );
    return ok(updated);
  },
);
