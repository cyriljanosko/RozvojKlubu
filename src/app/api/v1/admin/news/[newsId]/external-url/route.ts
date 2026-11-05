import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { setNewsExternalUrl } from "@/server/services/news.service";

/** PUT – link to the article on futbalsfz.sk. Body: { expectedVersion, url | null } (admin_sfz) */
export const PUT = apiHandler<RouteContext<"/api/v1/admin/news/[newsId]/external-url">>(
  async (request, context) => {
    await connection();
    const { newsId } = await context.params;
    const post = await setNewsExternalUrl(
      newsDeps,
      await getCurrentUser(request.headers),
      newsId,
      await request.json(),
    );
    return ok(post);
  },
);
