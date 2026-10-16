import { connection } from "next/server";

import { apiHandler, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/session";
import { mongoSectionStore } from "@/server/db/content.store";
import { listMethodology } from "@/server/services/methodology.service";

/** GET /api/v1/areas/:area/methodology – Markdown sections (signed-in users). */
export const GET = apiHandler<RouteContext<"/api/v1/areas/[area]/methodology">>(
  async (request, context) => {
    await connection();
    const { area } = await context.params;
    const sections = await listMethodology(
      mongoSectionStore,
      await getCurrentUser(request.headers),
      Number(area),
    );
    return ok(sections, { headers: { "Cache-Control": "no-store" } });
  },
);
