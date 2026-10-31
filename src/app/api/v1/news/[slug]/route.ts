import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { newsDeps } from "@/server/clubs/deps";
import { getPublishedNews } from "@/server/services/news.service";

/** GET – a published post with related posts (public, ADR 0023). */
export const GET = apiHandler<RouteContext<"/api/v1/news/[slug]">>(async (_request, context) => {
  await connection();
  const { slug } = await context.params;
  return ok(await getPublishedNews(newsDeps, slug));
});
