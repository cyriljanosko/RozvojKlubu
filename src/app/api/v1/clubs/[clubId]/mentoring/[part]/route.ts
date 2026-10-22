import { connection } from "next/server";

import { ApiError } from "@/server/api/errors";
import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mentoringDeps } from "@/server/clubs/deps";
import { saveMentoringPart, type MentoringPartKey } from "@/server/services/club-mentoring.service";

const PARTS: Record<string, MentoringPartKey> = {
  intro: "intro",
  focus: "focus",
  "closing-club": "closingClub",
  "closing-mentor": "closingMentor",
};

/** PUT – save one part of this season's cycle (MC). Parts: intro, focus, closing-club,
 *  closing-mentor. Body: the part's fields + expectedVersion (0 creates the season). */
export const PUT = apiHandler<RouteContext<"/api/v1/clubs/[clubId]/mentoring/[part]">>(
  async (request, context) => {
    await connection();
    const { clubId, part } = await context.params;
    const key = PARTS[part];
    if (!key) throw new ApiError("NOT_FOUND", "Unknown part");
    const view = await saveMentoringPart(
      mentoringDeps,
      await getCurrentUser(request.headers),
      clubId,
      key,
      await request.json(),
    );
    return ok(view);
  },
);
