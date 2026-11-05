import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { returnNewsToClub } from "@/server/services/news.service";

/** POST – return a submitted club post with a note. Body: { expectedVersion, note } (admin_sfz) */
export const POST = apiHandler<RouteContext<"/api/v1/admin/news/[newsId]/return">>(
  async (request, context) => {
    await connection();
    const { newsId } = await context.params;
    const post = await returnNewsToClub(
      newsDeps,
      await getCurrentUser(request.headers),
      newsId,
      await request.json(),
    );
    return ok(post);
  },
);
