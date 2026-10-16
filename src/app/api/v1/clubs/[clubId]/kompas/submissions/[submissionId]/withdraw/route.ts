import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { withdrawKompasSubmission } from "@/server/services/kompas-submission.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/kompas/submissions/[submissionId]/withdraw">;

/** POST – withdraw a submitted Kompas (admin_sfz only, ADR 0009); it stays in the history. */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId, submissionId } = await context.params;
  const withdrawn = await withdrawKompasSubmission(
    submissionDeps,
    await getCurrentUser(request.headers),
    clubId,
    submissionId,
  );
  return ok(withdrawn);
});
