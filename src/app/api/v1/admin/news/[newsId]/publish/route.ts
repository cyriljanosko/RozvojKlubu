import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { publishNews } from "@/server/services/news.service";

/** POST – publish (club post with consent and confirmed text, or academy post). Body: { expectedVersion } (admin_sfz) */
export const POST = apiHandler<RouteContext<"/api/v1/admin/news/[newsId]/publish">>(
  async (request, context) => {
    await connection();
    const { newsId } = await context.params;
    const post = await publishNews(
      newsDeps,
      await getCurrentUser(request.headers),
      newsId,
      await request.json(),
    );
    return ok(post);
  },
);
