import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { createMentorVisit, listMentorVisits } from "@/server/services/mentor-visit.service";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/mentor-visits">;

/** GET – mentor visits of the club (the club sees sent ones, mentor and admin_sfz all). */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const list = await listMentorVisits(visitDeps, await getCurrentUser(request.headers), clubId);
  return ok(list, { headers: { "Cache-Control": "no-store" } });
});

/** POST – record a visit as a draft (the club's mentor or admin_sfz).
 *  Body: { date, form, participants, summary, findings, actions } */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const visit = await createMentorVisit(
    visitDeps,
    await getCurrentUser(request.headers),
    clubId,
    await request.json(),
  );
  return ok(visit, { status: 201 });
});
