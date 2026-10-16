import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listRoleCatalogRevisions } from "@/server/services/role-catalog.service";

/** GET /api/v1/roles/revisions – change history of the role catalog (without bodies), admin_sfz. */
export const GET = apiHandler(async (request) => {
  await connection();
  const revisions = await listRoleCatalogRevisions(
    mongoContentStore,
    await getCurrentUser(request.headers),
  );
  return ok(revisions, { headers: { "Cache-Control": "no-store" } });
});
