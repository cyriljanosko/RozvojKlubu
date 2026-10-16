import "server-only";

import { betterAuthUserDirectory } from "@/server/auth/session";
import { mongoClubStore, mongoMembershipStore } from "@/server/db/clubs.store";
import type { ClubDeps } from "@/server/services/clubs.service";

/** Production wiring of the club services (route handlers, pages, server actions). */
export const clubDeps: ClubDeps = {
  clubs: mongoClubStore,
  memberships: mongoMembershipStore,
  users: betterAuthUserDirectory,
};
