import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { preferencesDeps } from "@/server/clubs/deps";
import { addFavorite, orderFavorites, removeFavorite } from "@/server/services/preferences.service";

/** POST /api/v1/me/favorites – pin a page. Body: { kind, href, label } (pinning twice keeps one). */
export const POST = apiHandler(async (request) => {
  await connection();
  const view = await addFavorite(
    preferencesDeps,
    await getCurrentUser(request.headers),
    await request.json(),
  );
  return ok(view, { status: 201 });
});

/** PUT – reorder. Body: { ids: [...], expectedVersion } */
export const PUT = apiHandler(async (request) => {
  await connection();
  const view = await orderFavorites(
    preferencesDeps,
    await getCurrentUser(request.headers),
    await request.json(),
  );
  return ok(view);
});

/** DELETE ?id= or ?href= – unpin. */
export const DELETE = apiHandler(async (request) => {
  await connection();
  const params = new URL(request.url).searchParams;
  const view = await removeFavorite(preferencesDeps, await getCurrentUser(request.headers), {
    id: params.get("id") ?? undefined,
    href: params.get("href") ?? undefined,
  });
  return ok(view);
});
