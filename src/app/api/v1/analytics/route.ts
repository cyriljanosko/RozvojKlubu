import { connection } from "next/server";
import { z } from "zod";

import { defaultMessages } from "@/i18n/config";
import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { analyticsDeps } from "@/server/clubs/deps";
import { analyticsCsv, getAnalytics } from "@/server/services/analytics.service";

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
  format: z.enum(["json", "csv"]).optional(),
});

/** GET /api/v1/analytics?season=&union=&size=&clubs=a,b – panels data for the analysis workspace,
 *  scoped by role (admin_sfz all, mentor the cohort, club roles their club + anonymous average).
 *  `format=csv` returns the same view as a spreadsheet, one row per club (DA-c). */
export const GET = apiHandler(async (request) => {
  await connection();
  const { format, ...filter } = querySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const view = await getAnalytics(analyticsDeps, await getCurrentUser(request.headers), filter);
  if (format === "csv") {
    const labels = defaultMessages.analytics.csv;
    const name = `${labels.file}-${view.season.replace("/", "-")}.csv`;
    // BOM so that Excel reads UTF-8 diacritics
    return new Response(
      `\uFEFF${analyticsCsv(view, { ...labels, sizes: defaultMessages.analytics.sizes })}`,
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return ok(view, { headers: { "Cache-Control": "no-store" } });
});
