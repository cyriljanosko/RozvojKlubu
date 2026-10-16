import { connection } from "next/server";
import { z } from "zod";

import { apiHandler, ok } from "@/server/api/http";
import { betterAuthUserStore, getCurrentUser } from "@/server/auth/session";
import { changeUserRole } from "@/server/services/users.service";

const bodySchema = z.object({ role: z.string() });

/** PATCH /api/v1/users/:id/role – admin_sfz only. Body: { role } */
export const PATCH = apiHandler<RouteContext<"/api/v1/users/[id]/role">>(
  async (request, context) => {
    await connection();
    const { id } = await context.params;
    const actor = await getCurrentUser(request.headers);
    const { role } = bodySchema.parse(await request.json());
    const updated = await changeUserRole(betterAuthUserStore, actor, id, role);
    return ok(updated);
  },
);
