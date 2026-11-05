import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { submitClubNews } from "@/server/services/news.service";

/** POST – send the post to SFZ, also to confirm SFZ edits (club management).
 *  Body: { expectedVersion, consents: { publication: true, photoPeople, external } } */
export const POST = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/news/[newsId]/submit">>(
  async (request, context) => {
    await connection();
    const { clubId, newsId } = await context.params;
    const post = await submitClubNews(
      newsDeps,
      await getCurrentUser(request.headers),
      clubId,
      newsId,
      await request.json(),
    );
    return ok(post);
  },
);
