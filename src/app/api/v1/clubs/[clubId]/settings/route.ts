import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { settingsDeps } from "@/server/clubs/deps";
import { getClubSettings } from "@/server/services/club-settings.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/settings">;

/** GET – the club's settings (any club role, admin_sfz), e.g. the consent to the rankings (ADR 0015). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await getClubSettings(settingsDeps, await getCurrentUser(request.headers), clubId);
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});
