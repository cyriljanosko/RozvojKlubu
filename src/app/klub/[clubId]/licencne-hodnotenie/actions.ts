"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { licensingDeps } from "@/server/clubs/deps";
import type { LicensingInputs } from "@/server/db/types";
import {
  closeLicensing,
  reopenLicensing,
  saveLicensing,
} from "@/server/services/licensing.service";

/** Thin Server Actions over the licensing service (permissions and validation live there). */
type ErrorCode = "CONFLICT" | "FORBIDDEN" | "BAD_REQUEST" | "INTERNAL";

function toError(error: unknown, what: string): { status: "error"; code: ErrorCode } {
  if (error instanceof ApiError && ["CONFLICT", "FORBIDDEN", "BAD_REQUEST"].includes(error.code)) {
    return { status: "error", code: error.code as ErrorCode };
  }
  if ((error as { name?: string })?.name === "ZodError")
    return { status: "error", code: "BAD_REQUEST" };
  console.error(`[licensing] ${what} failed`, error);
  return { status: "error", code: "INTERNAL" };
}

export type SaveLicensingResult =
  { status: "ok"; version: number } | { status: "error"; code: ErrorCode };

export async function saveLicensingAction(
  clubId: string,
  season: string,
  inputs: LicensingInputs,
  expectedVersion: number,
): Promise<SaveLicensingResult> {
  try {
    const view = await saveLicensing(licensingDeps, await getCurrentUser(await headers()), clubId, {
      season,
      inputs,
      expectedVersion,
    });
    refresh();
    return { status: "ok", version: view.version };
  } catch (error) {
    return toError(error, "save");
  }
}

export type CloseLicensingResult = { status: "ok" } | { status: "error"; code: ErrorCode };

export async function closeLicensingAction(
  clubId: string,
  season: string,
  expectedVersion: number,
): Promise<CloseLicensingResult> {
  try {
    await closeLicensing(licensingDeps, await getCurrentUser(await headers()), clubId, {
      season,
      expectedVersion,
    });
    refresh();
    return { status: "ok" };
  } catch (error) {
    return toError(error, "close");
  }
}

export async function reopenLicensingAction(
  clubId: string,
  season: string,
): Promise<CloseLicensingResult> {
  try {
    await reopenLicensing(licensingDeps, await getCurrentUser(await headers()), clubId, { season });
    refresh();
    return { status: "ok" };
  } catch (error) {
    return toError(error, "reopen");
  }
}
