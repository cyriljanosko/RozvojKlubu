"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError, type ApiErrorCode } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { addClubMember, removeClubMember } from "@/server/services/clubs.service";

/** Thin Server Action layer over the club services (validation and permissions live there). */
export type ActionState =
  { status: "idle" } | { status: "ok" } | { status: "error"; code: ApiErrorCode };

const failure = (error: unknown): ActionState => {
  if (error instanceof ApiError) return { status: "error", code: error.code };
  if ((error as { name?: string })?.name === "ZodError") {
    return { status: "error", code: "BAD_REQUEST" };
  }
  console.error("[admin] action failed", error);
  return { status: "error", code: "INTERNAL" };
};

export async function addMemberAction(
  clubId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await getCurrentUser(await headers());
    const ageGroups = String(formData.get("ageGroups") ?? "")
      .split(/[\s,]+/)
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
    await addClubMember(clubDeps, actor, clubId, {
      email: formData.get("email"),
      role: formData.get("role"),
      ageGroups,
    });
    refresh();
    return { status: "ok" };
  } catch (error) {
    return failure(error);
  }
}

export async function removeMemberAction(clubId: string, membershipId: string): Promise<void> {
  const actor = await getCurrentUser(await headers());
  await removeClubMember(clubDeps, actor, clubId, membershipId);
  refresh();
}
