"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { settingsDeps } from "@/server/clubs/deps";
import { setRankingConsent } from "@/server/services/club-settings.service";

/** Thin Server Action over the club settings service (MR-c, ADR 0015). */
export type ConsentResult =
  { status: "ok" } | { status: "error"; code: "CONFLICT" | "FORBIDDEN" | "INTERNAL" };

export async function setRankingConsentAction(
  clubId: string,
  given: boolean,
  expectedVersion: number,
): Promise<ConsentResult> {
  try {
    await setRankingConsent(settingsDeps, await getCurrentUser(await headers()), clubId, {
      given,
      expectedVersion,
    });
    refresh();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof ApiError && (error.code === "CONFLICT" || error.code === "FORBIDDEN")) {
      return { status: "error", code: error.code };
    }
    console.error("[settings] ranking consent failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
