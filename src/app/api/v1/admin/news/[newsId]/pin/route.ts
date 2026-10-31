import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { setNewsPinned } from "@/server/services/news.service";

/** PUT – pin or unpin a published post. Body: { expectedVersion, pinned } (admin_sfz) */
export const PUT = apiHandler<RouteContext<"/api/v1/admin/news/[newsId]/pin">>(
  async (request, context) => {
    await connection();
    const { newsId } = await context.params;
    const post = await setNewsPinned(
      newsDeps,
      await getCurrentUser(request.headers),
      newsId,
      await request.json(),
    );
    return ok(post);
  },
);
