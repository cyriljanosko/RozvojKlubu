"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { mentoringDeps } from "@/server/clubs/deps";
import { saveMentoringPart, type MentoringPartKey } from "@/server/services/club-mentoring.service";

/** Thin Server Action over the club mentoring service (MC-c); validation lives there. */
export async function saveMentoringPartAction(
  clubId: string,
  part: MentoringPartKey,
  values: Record<string, string | number[]>,
  expectedVersion: number,
): Promise<{ status: "ok" } | { status: "error"; code: string }> {
  try {
    await saveMentoringPart(mentoringDeps, await getCurrentUser(await headers()), clubId, part, {
      ...values,
      expectedVersion,
    });
    refresh();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof ApiError) return { status: "error", code: error.code };
    if ((error as { name?: string })?.name === "ZodError") {
      return { status: "error", code: "BAD_REQUEST" };
    }
    console.error("[mentoring] save failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
