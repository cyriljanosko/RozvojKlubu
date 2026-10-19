"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { kompasDeps, submissionDeps } from "@/server/clubs/deps";
import { submitKompas } from "@/server/services/kompas-submission.service";
import { saveKompasAnswers } from "@/server/services/kompas.service";

/** Thin Server Action over the Kompas service (permissions and validation live there). */
export type SaveKompasResult =
  | { status: "ok"; version: number }
  | { status: "error"; code: "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "INTERNAL" };

export async function saveKompasAction(
  clubId: string,
  answers: string[],
  expectedVersion: number,
): Promise<SaveKompasResult> {
  try {
    const view = await saveKompasAnswers(
      kompasDeps,
      await getCurrentUser(await headers()),
      clubId,
      {
        answers,
        expectedVersion,
      },
    );
    refresh();
    return { status: "ok", version: view.version };
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["CONFLICT", "FORBIDDEN", "BAD_REQUEST"].includes(error.code)
    ) {
      return { status: "error", code: error.code as "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" };
    }
    if ((error as { name?: string })?.name === "ZodError")
      return { status: "error", code: "BAD_REQUEST" };
    console.error("[kompas] save failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}

export type SubmitKompasResult =
  | { status: "ok"; line: string }
  | { status: "error"; code: "CONFLICT" | "BAD_REQUEST" | "FORBIDDEN" | "INTERNAL" };

export async function submitKompasAction(
  clubId: string,
  expectedVersion: number,
): Promise<SubmitKompasResult> {
  try {
    const sub = await submitKompas(submissionDeps, await getCurrentUser(await headers()), clubId, {
      expectedVersion,
    });
    refresh();
    return { status: "ok", line: sub.line };
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["CONFLICT", "FORBIDDEN", "BAD_REQUEST"].includes(error.code)
    ) {
      return { status: "error", code: error.code as "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" };
    }
    console.error("[kompas] submit failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
