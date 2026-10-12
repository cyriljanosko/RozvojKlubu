import { connection } from "next/server";

import { getDb, isDatabaseConfigured } from "@/server/db/mongo";
import { apiHandler, ok } from "@/server/api/http";
import { getHealth } from "@/server/services/health.service";

export const GET = apiHandler(async () => {
  await connection(); // always evaluate at request time

  const report = await getHealth({
    isDatabaseConfigured,
    pingDatabase: async () => {
      const db = await getDb();
      await db.command({ ping: 1 });
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });

  return ok(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
});
