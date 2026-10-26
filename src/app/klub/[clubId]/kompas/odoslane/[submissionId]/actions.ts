"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import {
  confirmKompasSubmission,
  withdrawKompasSubmission,
} from "@/server/services/kompas-submission.service";

/** Thin Server Action over the Kompas submission service (ADR 0009). */
export type WithdrawResult =
  { status: "ok" } | { status: "error"; code: "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL" };

export async function withdrawSubmissionAction(
  clubId: string,
  submissionId: string,
): Promise<WithdrawResult> {
  try {
    await withdrawKompasSubmission(
      submissionDeps,
      await getCurrentUser(await headers()),
      clubId,
      submissionId,
    );
    refresh();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof ApiError && ["CONFLICT", "FORBIDDEN", "NOT_FOUND"].includes(error.code)) {
      return { status: "error", code: error.code as "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" };
    }
    console.error("[kompas] withdraw failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}

/** The club's mentor or admin_sfz confirms the Kompas or takes it back (MR-c, ADR 0015). */
export async function confirmSubmissionAction(
  clubId: string,
  submissionId: string,
  confirmed: boolean,
): Promise<WithdrawResult> {
  try {
    await confirmKompasSubmission(
      submissionDeps,
      await getCurrentUser(await headers()),
      clubId,
      submissionId,
      confirmed,
    );
    refresh();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof ApiError && ["CONFLICT", "FORBIDDEN", "NOT_FOUND"].includes(error.code)) {
      return { status: "error", code: error.code as "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" };
    }
    console.error("[kompas] confirm failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
