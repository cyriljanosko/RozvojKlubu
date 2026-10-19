"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps } from "@/server/clubs/deps";
import { saveAreaRoleChoice } from "@/server/services/academy.service";

/** Thin Server Action over the academy service (validation and permissions live there). */
export async function saveAreaRolesAction(
  clubId: string,
  roles: string[],
): Promise<{ status: "ok" } | { status: "error" }> {
  try {
    await saveAreaRoleChoice(academyDeps, await getCurrentUser(await headers()), clubId, { roles });
    refresh();
    return { status: "ok" };
  } catch (error) {
    if (!(error instanceof ApiError)) console.error("[academy] save roles failed", error);
    return { status: "error" };
  }
}
