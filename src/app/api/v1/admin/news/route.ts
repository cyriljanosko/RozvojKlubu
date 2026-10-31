import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { createAcademyNews, listAdminNews } from "@/server/services/news.service";

/** GET – posts to review and academy news (admin_sfz). Query: status. Club drafts are not listed. */
export const GET = apiHandler(async (request) => {
  await connection();
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const list = await listAdminNews(newsDeps, await getCurrentUser(request.headers), query);
  return ok(list, { headers: { "Cache-Control": "no-store" } });
});

/** POST – start a novinka Akadémie as a draft (admin_sfz). Body: { title, areas, sections } */
export const POST = apiHandler(async (request) => {
  await connection();
  const post = await createAcademyNews(
    newsDeps,
    await getCurrentUser(request.headers),
    await request.json(),
  );
  return ok(post, { status: 201 });
});
