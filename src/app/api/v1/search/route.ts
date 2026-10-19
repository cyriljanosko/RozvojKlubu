import { connection } from "next/server";
import { z } from "zod";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { searchDeps } from "@/server/clubs/deps";
import { search } from "@/server/services/search.service";

const querySchema = z.object({ q: z.string().max(100).default("") });

/** GET /api/v1/search?q= – public search over areas, Metodika, Prax and clubs (H6). */
export const GET = apiHandler(async (request) => {
  await connection();
  const { q } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const user = await getCurrentUser(request.headers).catch(() => null);
  return ok(await search(searchDeps, user, q));
});
