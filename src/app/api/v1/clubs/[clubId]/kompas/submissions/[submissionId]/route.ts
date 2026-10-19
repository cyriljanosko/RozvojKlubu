import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { getSubmission } from "@/server/services/kompas-submission.service";

/** GET – one submitted (frozen) Kompas with answers, question texts, result and transfer line. */
export const GET = apiHandler<
  RouteContext<"/api/v1/clubs/[clubId]/kompas/submissions/[submissionId]">
>(async (request, context) => {
  await connection();
  const { clubId, submissionId } = await context.params;
  const submission = await getSubmission(
    submissionDeps,
    await getCurrentUser(request.headers),
    clubId,
    submissionId,
  );
  return ok(submission, { headers: { "Cache-Control": "no-store" } });
});
