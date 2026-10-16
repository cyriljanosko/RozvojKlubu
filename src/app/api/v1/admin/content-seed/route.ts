import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { seedContent } from "@/server/services/content.service";

/** POST /api/v1/admin/content-seed – inserts missing areas and questions from content/, admin_sfz. */
export const POST = apiHandler(async (request) => {
  await connection();
  const result = await seedContent(mongoContentStore, await getCurrentUser(request.headers));
  return ok(result);
});
