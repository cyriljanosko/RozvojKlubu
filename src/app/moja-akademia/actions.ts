"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, preferencesDeps } from "@/server/clubs/deps";
import { saveAreaRoleChoice } from "@/server/services/academy.service";
import { saveDashboard } from "@/server/services/preferences.service";

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

/** Saves the dashboard layout in the account (MD-b); returns the new version or the error code. */
export async function saveDashboardAction(
  dashboard: { order: string[]; hidden: string[] },
  expectedVersion: number,
): Promise<{ status: "ok"; version: number } | { status: "error"; code: string }> {
  try {
    const saved = await saveDashboard(preferencesDeps, await getCurrentUser(await headers()), {
      dashboard,
      expectedVersion,
    });
    return { status: "ok", version: saved.version };
  } catch (error) {
    if (error instanceof ApiError) return { status: "error", code: error.code };
    console.error("[academy] save dashboard failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
