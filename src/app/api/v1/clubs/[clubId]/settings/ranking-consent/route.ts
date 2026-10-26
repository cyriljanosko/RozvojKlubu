import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { settingsDeps } from "@/server/clubs/deps";
import { setRankingConsent } from "@/server/services/club-settings.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/settings/ranking-consent">;

/** PUT – give or withdraw the consent to the public rankings (club management only, ADR 0015).
 *  Body: { given: boolean, expectedVersion } (0 creates the settings) */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await setRankingConsent(
    settingsDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(view);
});
