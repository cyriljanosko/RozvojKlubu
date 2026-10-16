import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listQuestions } from "@/server/services/content.service";

/** GET /api/v1/kompas/questions?area=3 – Kompas questions (signed-in users). */
export const GET = apiHandler(async (request) => {
  await connection();
  const raw = new URL(request.url).searchParams.get("area");
  const questions = await listQuestions(
    mongoContentStore,
    await getCurrentUser(request.headers),
    raw === null ? undefined : Number(raw),
  );
  return ok(questions, { headers: { "Cache-Control": "no-store" } });
});
