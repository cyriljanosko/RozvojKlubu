import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { planDeps } from "@/server/clubs/deps";
import { confirmClubPlan } from "@/server/services/club-plan.service";

/** POST – the club's mentor (or admin_sfz) confirms the plan. Body: { confirmed, expectedVersion } */
export const POST = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/plan/confirm">>(
  async (request, context) => {
    await connection();
    const { clubId } = await context.params;
    const view = await confirmClubPlan(
      planDeps,
      await getCurrentUser(request.headers),
      clubId,
      await request.json(),
    );
    return ok(view);
  },
);
