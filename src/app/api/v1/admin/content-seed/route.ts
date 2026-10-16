import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { loadMethodologyFiles } from "@/server/content/methodology-loader";
import { mongoContentStore, mongoSectionStore } from "@/server/db/content.store";
import { seedContent } from "@/server/services/content.service";
import { seedMethodology } from "@/server/services/methodology.service";

/** POST /api/v1/admin/content-seed – inserts missing areas, questions and methodology
 *  sections from content/ (never overwrites edits), admin_sfz. */
export const POST = apiHandler(async (request) => {
  await connection();
  const actor = await getCurrentUser(request.headers);
  const result = await seedContent(mongoContentStore, actor);
  const sections = await seedMethodology(mongoSectionStore, actor, await loadMethodologyFiles());
  return ok({ ...result, sections });
});
