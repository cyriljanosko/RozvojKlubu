import "server-only";

import { refresh } from "next/cache";

import { ApiError } from "@/server/api/errors";

/** Result of the Novinky Server Actions (club proposals and administration). */
export type NewsActionResult =
  | { status: "ok"; version: number }
  | {
      status: "error";
      code: "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "INCOMPLETE" | "INTERNAL";
    };

const KNOWN = ["CONFLICT", "FORBIDDEN", "BAD_REQUEST", "NOT_FOUND"] as const;

/** Runs a news service call for a Server Action and maps its errors (permissions live in the service). */
export async function runNewsAction(
  fn: () => Promise<{ version: number }>,
): Promise<NewsActionResult> {
  try {
    const post = await fn();
    refresh();
    return { status: "ok", version: post.version };
  } catch (error) {
    if (error instanceof ApiError) {
      const missing = (error.details as { missing?: unknown } | undefined)?.missing;
      if (error.code === "BAD_REQUEST" && Array.isArray(missing)) {
        return { status: "error", code: "INCOMPLETE" };
      }
      if ((KNOWN as readonly string[]).includes(error.code)) {
        return { status: "error", code: error.code as (typeof KNOWN)[number] };
      }
    }
    if ((error as { name?: string })?.name === "ZodError") {
      return { status: "error", code: "BAD_REQUEST" };
    }
    console.error("[news] action failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}
