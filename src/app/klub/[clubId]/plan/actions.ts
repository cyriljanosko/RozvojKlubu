"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { planDeps } from "@/server/clubs/deps";
import {
  confirmClubPlan,
  saveClubPlan,
  setGoalStatus,
  type planInputSchema,
} from "@/server/services/club-plan.service";
import type { PlanGoalStatus } from "@/server/db/types";
import type { z } from "zod";

/** Thin Server Actions over the club plan service (permissions and validation live there). */
export type PlanActionResult =
  | { status: "ok"; version: number }
  | { status: "error"; code: "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL" };

async function run(
  fn: () => Promise<{ plan: { version: number } | null }>,
): Promise<PlanActionResult> {
  try {
    const view = await fn();
    refresh();
    return { status: "ok", version: view.plan?.version ?? 0 };
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["CONFLICT", "FORBIDDEN", "BAD_REQUEST", "NOT_FOUND"].includes(error.code)
    ) {
      return {
        status: "error",
        code: error.code as "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND",
      };
    }
    if ((error as { name?: string })?.name === "ZodError")
      return { status: "error", code: "BAD_REQUEST" };
    console.error("[club-plan] action failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}

const user = async () => getCurrentUser(await headers());

export async function savePlanAction(
  clubId: string,
  input: z.infer<typeof planInputSchema>,
): Promise<PlanActionResult> {
  return run(async () => saveClubPlan(planDeps, await user(), clubId, input));
}

export async function setGoalStatusAction(
  clubId: string,
  goalId: string,
  status: PlanGoalStatus,
  expectedVersion: number,
): Promise<PlanActionResult> {
  return run(async () =>
    setGoalStatus(planDeps, await user(), clubId, goalId, { status, expectedVersion }),
  );
}

export async function confirmPlanAction(
  clubId: string,
  confirmed: boolean,
  expectedVersion: number,
): Promise<PlanActionResult> {
  return run(async () =>
    confirmClubPlan(planDeps, await user(), clubId, { confirmed, expectedVersion }),
  );
}
