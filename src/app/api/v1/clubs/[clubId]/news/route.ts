import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { createClubNews, listClubNews } from "@/server/services/news.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/news">;

/** GET – the club's posts in every state (management, the club's mentor, admin_sfz). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const list = await listClubNews(newsDeps, await getCurrentUser(request.headers), clubId);
  return ok(list, { headers: { "Cache-Control": "no-store" } });
});

/** POST – start a story or a tip as a draft (club management).
 *  Body: { kind: "story" | "tip", title, areas, sections: [{ key, text }] } */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const post = await createClubNews(
    newsDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(post, { status: 201 });
});
