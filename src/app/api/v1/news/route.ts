import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { newsDeps } from "@/server/clubs/deps";
import { listPublishedNews } from "@/server/services/news.service";

/** GET – published news, newest first (public, ADR 0023).
 *  Query: kind (story | tip | academy), area (1–11), before (ISO date, paging), limit (1–50). */
export const GET = apiHandler(async (request) => {
  await connection();
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return ok(await listPublishedNews(newsDeps, query));
});
