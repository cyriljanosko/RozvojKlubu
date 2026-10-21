import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { planDeps } from "@/server/clubs/deps";
import { getPublicPlan } from "@/server/services/club-plan.service";

/** GET – public: areas, public sentences and statuses of the season's goals (no names). */
export const GET = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/plan/public">>(
  async (_request, context) => {
    await connection();
    const { clubId } = await context.params;
    return ok(await getPublicPlan(planDeps, clubId));
  },
);
