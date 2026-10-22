import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { preferencesDeps } from "@/server/clubs/deps";
import { getPreferences, saveDashboard } from "@/server/services/preferences.service";

/** GET /api/v1/me/preferences – the user's dashboard layout and favourites (MD). */
export const GET = apiHandler(async (request) => {
  await connection();
  const view = await getPreferences(preferencesDeps, await getCurrentUser(request.headers));
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});

/** PUT – save the dashboard. Body: { dashboard: { order, hidden }, expectedVersion } (0 creates) */
export const PUT = apiHandler(async (request) => {
  await connection();
  const view = await saveDashboard(
    preferencesDeps,
    await getCurrentUser(request.headers),
    await request.json(),
  );
  return ok(view);
});
