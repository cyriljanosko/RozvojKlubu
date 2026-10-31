import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { hideNews } from "@/server/services/news.service";

/** POST – take a published post down. Body: { expectedVersion } (admin_sfz) */
export const POST = apiHandler<RouteContext<"/api/v1/admin/news/[newsId]/hide">>(
  async (request, context) => {
    await connection();
    const { newsId } = await context.params;
    const post = await hideNews(
      newsDeps,
      await getCurrentUser(request.headers),
      newsId,
      await request.json(),
    );
    return ok(post);
  },
);
