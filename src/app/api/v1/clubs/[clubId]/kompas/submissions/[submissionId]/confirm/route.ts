import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { confirmKompasSubmission } from "@/server/services/kompas-submission.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/kompas/submissions/[submissionId]/confirm">;

const confirm = (confirmed: boolean) =>
  apiHandler<Ctx>(async (request, context) => {
    await connection();
    const { clubId, submissionId } = await context.params;
    const summary = await confirmKompasSubmission(
      submissionDeps,
      await getCurrentUser(request.headers),
      clubId,
      submissionId,
      confirmed,
    );
    return ok(summary);
  });

/** POST – the club's mentor or admin_sfz confirms the submitted Kompas (a badge, ADR 0015). */
export const POST = confirm(true);
/** DELETE – takes the confirmation back. */
export const DELETE = confirm(false);
