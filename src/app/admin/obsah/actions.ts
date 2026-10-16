"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError, type ApiErrorCode } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { loadMethodologyFiles, loadPracticeFiles } from "@/server/content/methodology-loader";
import {
  mongoContentStore,
  mongoPracticeStore,
  mongoSectionStore,
} from "@/server/db/content.store";
import { revertQuestion, seedContent, updateQuestion } from "@/server/services/content.service";
import {
  revertSection,
  seedMethodology,
  updateSection,
} from "@/server/services/methodology.service";
import { revertPractice, seedPractice, updatePractice } from "@/server/services/practice.service";

/** Thin Server Action layer over the content service (validation and permissions live there). */
export type ContentActionState =
  | { status: "idle" }
  | {
      status: "ok";
      version?: number;
      areas?: number;
      questions?: number;
      sections?: number;
      practice?: number;
    }
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
    const actor = await getCurrentUser(await headers());
    const result = await seedContent(mongoContentStore, actor);
    const sections = await seedMethodology(mongoSectionStore, actor, await loadMethodologyFiles());
    const practice = await seedPractice(mongoPracticeStore, actor, await loadPracticeFiles());
    refresh();
    return { status: "ok", ...result, sections, practice };
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

const sectionStore = { ...mongoSectionStore, ...mongoContentStore };

export async function updateSectionAction(
  area: number,
  key: string,
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  try {
    const updated = await updateSection(
      sectionStore,
      await getCurrentUser(await headers()),
      area,
      key,
      {
        title: formData.get("title"),
        body: formData.get("body"),
        validAsOf: formData.get("validAsOf") || null,
        reviewedAt: formData.get("reviewedAt") || null,
        expectedVersion: Number(formData.get("expectedVersion")),
      },
    );
    refresh();
    return { status: "ok", version: updated.version };
  } catch (error) {
    return failure(error);
  }
}

export async function revertSectionAction(revisionId: string): Promise<void> {
  await revertSection(sectionStore, await getCurrentUser(await headers()), revisionId);
  refresh();
}

const practiceStore = { ...mongoPracticeStore, ...mongoContentStore };

export async function updatePracticeAction(
  area: number,
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  try {
    let content: unknown;
    try {
      content = JSON.parse(String(formData.get("content") ?? ""));
    } catch {
      return { status: "error", code: "BAD_REQUEST" };
    }
    const updated = await updatePractice(
      practiceStore,
      await getCurrentUser(await headers()),
      area,
      {
        content,
        validAsOf: formData.get("validAsOf") || null,
        reviewedAt: formData.get("reviewedAt") || null,
        expectedVersion: Number(formData.get("expectedVersion")),
      },
    );
    refresh();
    return { status: "ok", version: updated.version };
  } catch (error) {
    return failure(error);
  }
}

export async function revertPracticeAction(revisionId: string): Promise<void> {
  await revertPractice(practiceStore, await getCurrentUser(await headers()), revisionId);
  refresh();
}
