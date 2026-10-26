import "server-only";

import { getTranslations } from "next-intl/server";

import type { NavLink } from "@/components/sfz";
import type { NavContext, NavItem } from "@/lib/navigation";
import { clubDeps } from "@/server/clubs/deps";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { getCurrentUser } from "@/server/auth/session";
import { isAdmin } from "@/server/services/club-access";
import { listMyClubs, type ClubListItem } from "@/server/services/clubs.service";
import type { CurrentUser } from "@/server/services/users.service";

export interface FrameUser {
  user: CurrentUser | null;
  /** Clubs with a role of the person in the current season (admins see every club, with no role). */
  clubs: ClubListItem[];
  context: NavContext;
}

/** Signed-in person and their clubs for the app frame; auth problems must not break every page. */
export async function loadFrameUser(requestHeaders: Headers): Promise<FrameUser> {
  let user: CurrentUser | null = null;
  let clubs: ClubListItem[] = [];
  if (isDatabaseConfigured()) {
    try {
      user = await getCurrentUser(requestHeaders);
      if (user) clubs = await listMyClubs(clubDeps, user);
    } catch (error) {
      console.error(`[frame] cannot resolve session: ${(error as Error).message}`);
    }
  }
  const withRole = clubs.filter((club) => club.roles.length > 0);
  return {
    user,
    clubs,
    context: {
      signedIn: Boolean(user),
      isAdmin: user ? isAdmin(user) : false,
      clubs: withRole.map((club) => ({ clubId: club.clubId, roles: club.roles })),
    },
  };
}

/** Translates the navigation model's items into links for the frame components. */
export async function toLinks(items: readonly NavItem[]): Promise<NavLink[]> {
  const t = await getTranslations("nav");
  return items.map((entry) => ({
    id: entry.id,
    label: t(entry.labelKey),
    href: entry.href,
    ...(entry.icon && { icon: entry.icon }),
    ...(entry.match && { match: entry.match }),
  }));
}
