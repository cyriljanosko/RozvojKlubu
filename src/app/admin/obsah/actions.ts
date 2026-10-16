"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError, type ApiErrorCode } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { revertQuestion, seedContent, updateQuestion } from "@/server/services/content.service";

/** Thin Server Action layer over the content service (validation and permissions live there). */
export type ContentActionState =
  | { status: "idle" }
  | { status: "ok"; version?: number; areas?: number; questions?: number }
  | { status: "error"; code: ApiErrorCode };

const failure = (error: unknown): ContentActionState => {
  if (error instanceof ApiError) return { status: "error", code: error.code };
  if ((error as { name?: string })?.name === "ZodError") {
    return { status: "error", code: "BAD_REQUEST" };
  }
  console.error("[admin/content] action failed", error);
  return { status: "error", code: "INTERNAL" };
};

export async function seedContentAction(): Promise<ContentActionState> {
  try {
    const result = await seedContent(mongoContentStore, await getCurrentUser(await headers()));
    refresh();
    return { status: "ok", ...result };
  } catch (error) {
    return failure(error);
  }
}

export async function updateQuestionAction(
  questionId: string,
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  try {
    const updated = await updateQuestion(
      mongoContentStore,
      await getCurrentUser(await headers()),
      questionId,
      {
        text: formData.get("text"),
        tags: formData.getAll("tags"),
        expectedVersion: Number(formData.get("expectedVersion")),
      },
    );
    refresh();
    return { status: "ok", version: updated.version };
  } catch (error) {
    return failure(error);
  }
}

export async function revertQuestionAction(revisionId: string): Promise<void> {
  await revertQuestion(mongoContentStore, await getCurrentUser(await headers()), revisionId);
  refresh();
}
