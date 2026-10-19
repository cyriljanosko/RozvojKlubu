import { connection } from "next/server";

import { ApiError } from "@/server/api/errors";
import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoRoleCatalogStore } from "@/server/db/content.store";
import { getRoleCatalog, updateRoleCatalog } from "@/server/services/role-catalog.service";

/** GET /api/v1/roles – role catalog: base roles and roles in the 11 areas (signed-in users, ADR 0010). */
export const GET = apiHandler(async (request) => {
  await connection();
  const catalog = await getRoleCatalog(
    mongoRoleCatalogStore,
    await getCurrentUser(request.headers),
  );
  if (!catalog) throw new ApiError("NOT_FOUND", "Role catalog not found");
  return ok(catalog, { headers: { "Cache-Control": "no-store" } });
});

/** PUT /api/v1/roles – admin_sfz. Body: { content, expectedVersion } */
export const PUT = apiHandler(async (request) => {
  await connection();
  const updated = await updateRoleCatalog(
    { ...mongoRoleCatalogStore, ...mongoContentStore },
    await getCurrentUser(request.headers),
    await request.json(),
  );
  return ok(updated);
});
