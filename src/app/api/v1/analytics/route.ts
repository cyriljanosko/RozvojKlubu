import { connection } from "next/server";
import { z } from "zod";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { analyticsDeps } from "@/server/clubs/deps";
import { getAnalytics } from "@/server/services/analytics.service";

const querySchema = z.object({
  season: z
    .string()
    .regex(/^\d{4}\/\d{4}$/)
    .optional(),
  union: z.string().max(100).optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
  clubs: z
    .string()
    .max(2000)
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
});

/** GET /api/v1/analytics?season=&union=&size=&clubs=a,b – panels data for the analysis workspace,
 *  scoped by role (admin_sfz all, mentor the cohort, club roles their club + anonymous average). */
export const GET = apiHandler(async (request) => {
  await connection();
  const filter = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const view = await getAnalytics(analyticsDeps, await getCurrentUser(request.headers), filter);
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});
