import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { listMentorClubs } from "@/server/services/kompas-submission.service";

/** GET /api/v1/mentor/clubs – the mentor's clubs with their latest submitted Kompas. */
export const GET = apiHandler(async (request) => {
  await connection();
  const rows = await listMentorClubs(submissionDeps, await getCurrentUser(request.headers));
  return ok(rows, { headers: { "Cache-Control": "no-store" } });
});
