"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import type { MentorRating } from "@/server/db/types";
import { visitDeps } from "@/server/clubs/deps";
import {
  createMentorVisit,
  rateMentorVisit,
  sendMentorVisit,
  setPrepTaskDone,
  setVisitActionDone,
  updateMentorVisit,
  withdrawMentorVisit,
  type VisitInput,
} from "@/server/services/mentor-visit.service";

/** Thin Server Actions over the mentor visit service (permissions and validation live there). */
export type VisitActionResult =
  | { status: "ok"; id: string; version: number }
  | { status: "error"; code: "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL" };

async function run(fn: () => Promise<{ id: string; version: number }>): Promise<VisitActionResult> {
  try {
    const visit = await fn();
    refresh();
    return { status: "ok", id: visit.id, version: visit.version };
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
    console.error("[mentor-visit] action failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}

const user = async () => getCurrentUser(await headers());

/** Create a draft or a planned visit (visitId null) or save changes of an existing visit. */
export async function saveVisitAction(
  clubId: string,
  visitId: string | null,
  input: VisitInput & { planned?: boolean },
  expectedVersion: number,
): Promise<VisitActionResult> {
  return run(async () =>
    visitId
      ? updateMentorVisit(visitDeps, await user(), clubId, visitId, { ...input, expectedVersion })
      : createMentorVisit(visitDeps, await user(), clubId, input),
  );
}

export async function sendVisitAction(
  clubId: string,
  visitId: string,
  expectedVersion: number,
): Promise<VisitActionResult> {
  return run(async () =>
    sendMentorVisit(visitDeps, await user(), clubId, visitId, { expectedVersion }),
  );
}

export async function withdrawVisitAction(
  clubId: string,
  visitId: string,
  expectedVersion: number,
): Promise<VisitActionResult> {
  return run(async () =>
    withdrawMentorVisit(visitDeps, await user(), clubId, visitId, { expectedVersion }),
  );
}

/** Tick an agreed action as done or not (the club, its mentor, admin_sfz). */
export async function toggleVisitActionAction(
  clubId: string,
  visitId: string,
  actionId: string,
  done: boolean,
  expectedVersion: number,
): Promise<VisitActionResult> {
  return run(async () =>
    setVisitActionDone(visitDeps, await user(), clubId, visitId, actionId, {
      done,
      expectedVersion,
    }),
  );
}

/** The club ticks the task before the visit (MC). */
export async function prepDoneAction(
  clubId: string,
  visitId: string,
  done: boolean,
  expectedVersion: number,
): Promise<VisitActionResult> {
  return run(async () =>
    setPrepTaskDone(visitDeps, await user(), clubId, visitId, { done, expectedVersion }),
  );
}

/** The mentor rates the task before the visit and the agreed steps (MC). */
export async function rateVisitAction(
  clubId: string,
  visitId: string,
  ratings: {
    prep?: MentorRating | null;
    actions: { id: string; rating: MentorRating | null }[];
  },
  expectedVersion: number,
): Promise<VisitActionResult> {
  return run(async () =>
    rateMentorVisit(visitDeps, await user(), clubId, visitId, { ...ratings, expectedVersion }),
  );
}
