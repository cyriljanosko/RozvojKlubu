import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { planDeps } from "@/server/clubs/deps";
import { setGoalStatus } from "@/server/services/club-plan.service";

/** PATCH – change a goal's status (management, mentor, admin_sfz or the goal's owner).
 *  Body: { status: "todo" | "doing" | "done", expectedVersion } */
export const PATCH = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/plan/goals/[goalId]">>(
  async (request, context) => {
    await connection();
    const { clubId, goalId } = await context.params;
    const view = await setGoalStatus(
      planDeps,
      await getCurrentUser(request.headers),
      clubId,
      goalId,
      await request.json(),
    );
    return ok(view);
  },
);
