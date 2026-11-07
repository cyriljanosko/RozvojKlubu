import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { adminClubStore } from "@/server/clubs/deps";
import { listAdminClubs } from "@/server/services/admin-clubs.service";

/**
 * GET /api/v1/admin/clubs?q=&region=&union=&status=&inApp=&page= – clubs for the administration
 * (G5 Kluby): name or IČO search, filters and 25 clubs per page, all on the server. Only admin_sfz.
 */
export const GET = apiHandler(async (request) => {
  await connection();
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { clubs, unions, page } = await listAdminClubs(
    adminClubStore,
    await getCurrentUser(request.headers),
    query,
  );
  return ok({ clubs, unions }, { meta: page, headers: { "Cache-Control": "no-store" } });
});
