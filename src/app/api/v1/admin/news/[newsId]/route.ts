import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { getAdminNews, updateAdminNews } from "@/server/services/news.service";

type Ctx = RouteContext<"/api/v1/admin/news/[newsId]">;

/** GET – one post with the review details (admin_sfz). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { newsId } = await context.params;
  const post = await getAdminNews(newsDeps, await getCurrentUser(request.headers), newsId);
  return ok(post, { headers: { "Cache-Control": "no-store" } });
});

/** PATCH – edit the text (admin_sfz); a club post then waits for the club's confirmation.
 *  Body: { title, areas, sections, expectedVersion } */
export const PATCH = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { newsId } = await context.params;
  const post = await updateAdminNews(
    newsDeps,
    await getCurrentUser(request.headers),
    newsId,
    await request.json(),
  );
  return ok(post);
});
