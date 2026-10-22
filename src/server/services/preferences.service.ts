import { randomUUID } from "node:crypto";

import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { Favorite, FavoriteKind, UserPreferencesDoc } from "@/server/db/types";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * A user's own Moja Akadémia (MD, decisions 22. 10. 2026): the order and hidden tiles of the
 * dashboard and pinned favourites, stored in the account so they follow the user across devices.
 * Personal data of the user, not club data – keyed by userId only; a favourite is just a link,
 * the pinned page checks access itself.
 */
export interface PreferencesStore {
  findPreferences: (userId: string) => Promise<UserPreferencesDoc | null>;
  /** optimistic: expectedVersion 0 creates; null on a version conflict */
  savePreferences: (
    userId: string,
    expectedVersion: number,
    changes: Pick<UserPreferencesDoc, "dashboard" | "favorites" | "updatedAt">,
  ) => Promise<UserPreferencesDoc | null>;
}

export interface PreferencesDeps {
  preferences: PreferencesStore;
  now?: () => Date;
  newId?: () => string;
}

export const MAX_FAVORITES = 30;
const MAX_TILES = 30;
const FAVORITE_KINDS = [
  "area",
  "section",
  "practice",
  "pattern",
  "vizitka",
  "plan",
  "visits",
] as const satisfies readonly FavoriteKind[];

export interface PreferencesDto {
  dashboard: { order: string[]; hidden: string[] };
  favorites: Favorite[];
  /** 0 = nothing saved yet */
  version: number;
}

const tileId = z.string().regex(/^[a-z][a-z0-9-]{0,40}$/);
const tileList = z
  .array(tileId)
  .max(MAX_TILES)
  .transform((ids) => [...new Set(ids)]);

/** Internal path only: one leading "/", no scheme, no protocol-relative "//", no backslash. */
export const internalHref = z
  .string()
  .max(300)
  .regex(/^\/(?![/\\])[^\s\\]*$/, "Must be an internal path");

export const saveDashboardSchema = z.object({
  dashboard: z.object({ order: tileList, hidden: tileList }),
  expectedVersion: z.number().int().min(0),
});

export const addFavoriteSchema = z.object({
  kind: z.enum(FAVORITE_KINDS),
  href: internalHref,
  label: z.string().trim().min(1).max(160),
});

export const orderFavoritesSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).max(MAX_FAVORITES),
  expectedVersion: z.number().int().min(1),
});

const toDto = (doc: UserPreferencesDoc | null): PreferencesDto => ({
  dashboard: doc?.dashboard ?? { order: [], hidden: [] },
  favorites: doc?.favorites ?? [],
  version: doc?.version ?? 0,
});

export async function getPreferences(
  deps: PreferencesDeps,
  actor: CurrentUser | null,
): Promise<PreferencesDto> {
  const user = requireUser(actor);
  return toDto(await deps.preferences.findPreferences(user.id));
}

async function save(
  deps: PreferencesDeps,
  userId: string,
  expectedVersion: number,
  changes: Pick<UserPreferencesDoc, "dashboard" | "favorites">,
): Promise<PreferencesDto> {
  const saved = await deps.preferences.savePreferences(userId, expectedVersion, {
    ...changes,
    updatedAt: deps.now?.() ?? new Date(),
  });
  if (!saved) throw new ApiError("CONFLICT", "Preferences were changed meanwhile");
  return toDto(saved);
}

/** Saves the tile order and the hidden tiles (arrows, hide, "original layout" = empty lists). */
export async function saveDashboard(
  deps: PreferencesDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<PreferencesDto> {
  const user = requireUser(actor);
  const { dashboard, expectedVersion } = saveDashboardSchema.parse(input);
  const current = toDto(await deps.preferences.findPreferences(user.id));
  return save(deps, user.id, expectedVersion, { dashboard, favorites: current.favorites });
}

/**
 * Runs a change on the latest favourites; a concurrent change (another tab) is retried, so that
 * pinning from a page never needs a version.
 */
async function changeFavorites(
  deps: PreferencesDeps,
  userId: string,
  change: (favorites: Favorite[]) => Favorite[],
): Promise<PreferencesDto> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = toDto(await deps.preferences.findPreferences(userId));
    const saved = await deps.preferences.savePreferences(userId, current.version, {
      dashboard: current.dashboard,
      favorites: change(current.favorites),
      updatedAt: deps.now?.() ?? new Date(),
    });
    if (saved) return toDto(saved);
  }
  throw new ApiError("CONFLICT", "Preferences were changed meanwhile");
}

/** Pins a page; pinning the same page again keeps the first pin (idempotent). */
export async function addFavorite(
  deps: PreferencesDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<PreferencesDto> {
  const user = requireUser(actor);
  const fav = addFavoriteSchema.parse(input);
  const current = toDto(await deps.preferences.findPreferences(user.id));
  if (current.favorites.some((f) => f.href === fav.href)) return current;
  if (current.favorites.length >= MAX_FAVORITES) {
    throw new ApiError("BAD_REQUEST", `At most ${MAX_FAVORITES} favourites`, {
      code: "FAVORITES_FULL",
    });
  }
  const added: Favorite = {
    id: (deps.newId ?? randomUUID)(),
    ...fav,
    addedAt: deps.now?.() ?? new Date(),
  };
  return changeFavorites(deps, user.id, (list) =>
    list.some((f) => f.href === fav.href) ? list : [...list, added].slice(0, MAX_FAVORITES),
  );
}

/** Unpins by favourite id or by page path (the star on a page knows only its path). */
export async function removeFavorite(
  deps: PreferencesDeps,
  actor: CurrentUser | null,
  by: { id?: string; href?: string },
): Promise<PreferencesDto> {
  const user = requireUser(actor);
  if (!by.id && !by.href) throw new ApiError("BAD_REQUEST", "id or href required");
  return changeFavorites(deps, user.id, (list) =>
    list.filter((f) => f.id !== by.id && f.href !== by.href),
  );
}

/** Reorders favourites (arrows in the Obľúbené tile); ids not listed keep their place at the end. */
export async function orderFavorites(
  deps: PreferencesDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<PreferencesDto> {
  const user = requireUser(actor);
  const { ids, expectedVersion } = orderFavoritesSchema.parse(input);
  const current = toDto(await deps.preferences.findPreferences(user.id));
  const rank = (f: Favorite) => {
    const i = ids.indexOf(f.id);
    return i === -1 ? ids.length + current.favorites.indexOf(f) : i;
  };
  return save(deps, user.id, expectedVersion, {
    dashboard: current.dashboard,
    favorites: [...current.favorites].sort((a, b) => rank(a) - rank(b)),
  });
}
