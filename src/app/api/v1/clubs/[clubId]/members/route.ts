import { connection } from "next/server";

import { ApiError } from "@/server/api/errors";
import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { addClubMember, listClubMembers } from "@/server/services/clubs.service";
import { seasonFromSlug } from "@/server/services/season";

type Ctx = RouteContext<"/api/v1/clubs/[clubId]/members">;

/** GET /api/v1/clubs/:clubId/members?season=2026-2027 – admin_sfz only. */
export const GET = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const slug = new URL(request.url).searchParams.get("season");
  const season = slug === null ? undefined : seasonFromSlug(slug);
  if (season === null) throw new ApiError("BAD_REQUEST", "Invalid season");
  const members = await listClubMembers(
    clubDeps,
    await getCurrentUser(request.headers),
    clubId,
    season,
  );
  return ok(members, { headers: { "Cache-Control": "no-store" } });
});

/** POST /api/v1/clubs/:clubId/members – admin_sfz only. Body: { email, role, season?, ageGroups? } */
export const POST = apiHandler<Ctx>(async (request, context) => {
  await connection();
  const { clubId } = await context.params;
  const actor = await getCurrentUser(request.headers);
  const member = await addClubMember(clubDeps, actor, clubId, await request.json());
  return ok(member, { status: 201 });
});
