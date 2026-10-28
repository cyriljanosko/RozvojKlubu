import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { ClubSettingsDoc } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * The club's own settings (MR-a, ADR 0015) – for now the consent of club management to appear in
 * the public rankings (opt-in). Any club role and admin_sfz read; management gives or withdraws
 * the consent, admin_sfz may change it for the club (ADR 0020). Every query by clubId (ADR 0003).
 */
export interface ClubSettingsStore {
  findSettings: (clubId: string) => Promise<ClubSettingsDoc | null>;
  /** optimistic: expectedVersion 0 creates; null on a version conflict */
  saveSettings: (
    clubId: string,
    expectedVersion: number,
    changes: Pick<ClubSettingsDoc, "rankingConsent" | "updatedAt" | "updatedBy">,
  ) => Promise<ClubSettingsDoc | null>;
  /** clubIds whose consent to the public rankings is given (for the rankings, MR-b) */
  listRankingConsents: () => Promise<string[]>;
}

export interface ClubSettingsDeps extends ClubDeps {
  settings: ClubSettingsStore;
}

export interface ClubSettingsView {
  clubId: string;
  rankingConsent: { given: boolean; at: Date } | null;
  /** management or admin_sfz may change the consent */
  canEdit: boolean;
  /** 0 = nothing saved yet */
  version: number;
}

export const rankingConsentSchema = z.object({
  given: z.boolean(),
  expectedVersion: z.number().int().min(0),
});

async function rolesOf(deps: ClubSettingsDeps, user: CurrentUser, clubId: string) {
  const season = currentSeason(deps.now?.() ?? new Date());
  return clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
}

const view = (clubId: string, doc: ClubSettingsDoc | null, canEdit: boolean) => ({
  clubId,
  rankingConsent: doc?.rankingConsent
    ? { given: doc.rankingConsent.given, at: doc.rankingConsent.at }
    : null,
  canEdit,
  version: doc?.version ?? 0,
});

export async function getClubSettings(
  deps: ClubSettingsDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<ClubSettingsView> {
  const user = requireUser(actor);
  const roles = await rolesOf(deps, user, clubId);
  if (!isAdmin(user) && roles.length === 0)
    throw new ApiError("FORBIDDEN", "No access to this club");
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  return view(clubId, await deps.settings.findSettings(clubId), canDecide(user, roles));
}

/** Pure: club management decides, admin_sfz may change the consent for the club (ADR 0020). */
const canDecide = (user: CurrentUser, roles: readonly string[]) =>
  isAdmin(user) || roles.includes("management");

/** Gives or withdraws the consent to the public rankings (management or admin_sfz). */
export async function setRankingConsent(
  deps: ClubSettingsDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<ClubSettingsView> {
  const user = requireUser(actor);
  const roles = await rolesOf(deps, user, clubId);
  if (!canDecide(user, roles)) {
    throw new ApiError("FORBIDDEN", "Only club management or admin_sfz can decide on the rankings");
  }
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
  const { given, expectedVersion } = rankingConsentSchema.parse(input);
  const now = deps.now?.() ?? new Date();
  const saved = await deps.settings.saveSettings(clubId, expectedVersion, {
    rankingConsent: { given, at: now, by: user.id },
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "The settings were changed by someone else");
  return view(clubId, saved, true);
}
