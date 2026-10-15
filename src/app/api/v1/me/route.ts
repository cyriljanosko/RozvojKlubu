import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { requireUser } from "@/server/services/users.service";

/** GET /api/v1/me – the signed-in user (401 when not signed in). */
export const GET = apiHandler(async (request) => {
  await connection();
  const user = requireUser(await getCurrentUser(request.headers));
  return ok(user, { headers: { "Cache-Control": "no-store" } });
});
