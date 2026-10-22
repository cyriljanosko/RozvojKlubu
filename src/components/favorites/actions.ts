"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { preferencesDeps } from "@/server/clubs/deps";
import type { FavoriteKind } from "@/server/db/types";
import { addFavorite, orderFavorites, removeFavorite } from "@/server/services/preferences.service";

type Result = { status: "ok"; version: number } | { status: "error"; code: string };

/** Thin Server Actions over the preferences service (MD-c); validation lives there. */
async function run(work: () => Promise<{ version: number }>): Promise<Result> {
  try {
    const saved = await work();
    refresh();
    return { status: "ok", version: saved.version };
  } catch (error) {
    if (error instanceof ApiError) {
      const details = error.details as { code?: string } | undefined;
      return { status: "error", code: details?.code ?? error.code };
    }
    console.error("[favorites] action failed", error);
    return { status: "error", code: "INTERNAL" };
  }
}

export async function pinAction(fav: { kind: FavoriteKind; href: string; label: string }) {
  return run(async () => addFavorite(preferencesDeps, await getCurrentUser(await headers()), fav));
}

export async function unpinAction(by: { id?: string; href?: string }) {
  return run(async () =>
    removeFavorite(preferencesDeps, await getCurrentUser(await headers()), by),
  );
}

export async function orderFavoritesAction(ids: string[]) {
  return run(async () =>
    orderFavorites(preferencesDeps, await getCurrentUser(await headers()), { ids }),
  );
}
