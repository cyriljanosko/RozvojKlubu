import "server-only";

import { preferencesDeps } from "@/server/clubs/deps";
import { getPreferences } from "@/server/services/preferences.service";
import type { CurrentUser } from "@/server/services/users.service";

/** Paths the user has pinned – null for visitors (no star is shown then). */
export async function pinnedHrefs(user: CurrentUser | null): Promise<Set<string> | null> {
  if (!user) return null;
  const prefs = await getPreferences(preferencesDeps, user);
  return new Set(prefs.favorites.map((f) => f.href));
}
