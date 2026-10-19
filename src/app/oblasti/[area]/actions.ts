"use server";

import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { progressDeps } from "@/server/clubs/deps";
import { savePracticeProgress } from "@/server/services/practice-progress.service";

/** Thin Server Action over the practice progress service (permissions and validation live there). */
export type SaveProgressResult =
  | { status: "ok"; version: number; steps: { stepId: string; doneAt: string | null }[] }
  | { status: "error"; code: "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "INTERNAL" };

export async function saveProgressAction(
  clubId: string,
  area: number,
  input: {
    tasks: string[];
    steps: { stepId: string; option: number | null; done: boolean }[];
    expectedVersion: number;
  },
): Promise<SaveProgressResult> {
  try {
    const view = await savePracticeProgress(
      progressDeps,
      await getCurrentUser(await headers()),
      clubId,
      area,
      input,
    );
    return {
      status: "ok",
      version: view.version,
      steps: view.steps.map((s) => ({
        stepId: s.stepId,
        doneAt: s.doneAt ? new Date(s.doneAt).toISOString() : null,
      })),
    };
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["CONFLICT", "FORBIDDEN", "BAD_REQUEST"].includes(error.code)
    ) {
      return { status: "error", code: error.code as "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" };
    }
    if ((error as { name?: string })?.name === "ZodError")
      return { status: "error", code: "BAD_REQUEST" };
    console.error("[practice] progress save failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
