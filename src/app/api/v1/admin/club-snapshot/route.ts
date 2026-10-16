import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoSnapshotStore } from "@/server/db/clubs.store";
import { importClubSnapshot } from "@/server/services/clubs.service";

/** POST /api/v1/admin/club-snapshot – admin_sfz imports the Sportnet snapshot (ADR 0005). */
export const POST = apiHandler(async (request) => {
  await connection();
  const result = await importClubSnapshot(
    mongoSnapshotStore,
    await getCurrentUser(request.headers),
    await request.json(),
  );
  return ok(result);
});
