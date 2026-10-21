import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { planDeps } from "@/server/clubs/deps";
import { getClubPlan, saveClubPlan } from "@/server/services/club-plan.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/plan">;

/** GET – the club's plan for the current season (management, mentor, admin_sfz edit; coaches read). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await getClubPlan(planDeps, await getCurrentUser(request.headers), clubId);
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});

/** PUT – save the goals. Body: { goals: [...], expectedVersion } (0 creates the plan) */
export const PUT = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const view = await saveClubPlan(
    planDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(view);
});
