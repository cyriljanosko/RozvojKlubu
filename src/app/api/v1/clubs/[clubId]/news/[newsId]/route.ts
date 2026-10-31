import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { getClubNews, updateClubNews } from "@/server/services/news.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/news/[newsId]">;

/** GET – one post of the club (management, the club's mentor, admin_sfz). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, newsId } = await context.params;
  const post = await getClubNews(newsDeps, await getCurrentUser(request.headers), clubId, newsId);
  return ok(post, { headers: { "Cache-Control": "no-store" } });
});

/** PATCH – edit a draft or a returned post (club management).
 *  Body: { title, areas, sections, expectedVersion } */
export const PATCH = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, newsId } = await context.params;
  const post = await updateClubNews(
    newsDeps,
    await getCurrentUser(request.headers),
    clubId,
    newsId,
    await request.json(),
  );
  return ok(post);
});
