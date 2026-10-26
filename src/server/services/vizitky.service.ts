import { kompasStars, licensingStars, type RankedClub } from "@/lib/rankings";
import { placeOf } from "@/lib/slovakia-map";
import type { ClubSize } from "@/server/services/analytics.service";
import { getPublicVizitka, type VizitkaDeps } from "@/server/services/vizitka.service";

/**
 * Public list of club Vizitky for the map (VK-a, decisions 26. 10. 2026): the pilot clubs with
 * where they are (district → ObFZ → RFZ), their size and whether the Kompas was submitted and the
 * licensing closed – only what the public Vizitka already shows, no sign-in needed.
 * VK-b adds the stars of the rankings (`src/lib/rankings.ts`) and the licensing points.
 */
export interface VizitkaCard extends RankedClub {
  /** union of the competitions (Sportnet), e.g. "ObFZ Trebišov" or "SFZ" */
  union: string;
  size: ClubSize | null;
  licensingClosed: boolean;
}

export async function listVizitky(deps: VizitkaDeps): Promise<VizitkaCard[]> {
  const clubs = await deps.clubs.listClubs("all");
  const cards = await Promise.all(
    clubs.map(async (c) => {
      const v = await getPublicVizitka(deps, c.clubId);
      return {
        clubId: c.clubId,
        name: c.name,
        union: c.union,
        place: placeOf(c.clubId),
        size: v.profile?.size ?? null,
        players: v.profile?.players ?? null,
        kompas: v.kompas?.total ?? null,
        kompasStars: kompasStars(v.kompas?.total ?? null),
        licensing: v.licensing
          ? {
              points: v.licensing.areas.reduce((s, a) => s + a.points, 0),
              stars: licensingStars(v.licensing.areas),
            }
          : null,
        licensingClosed: v.licensing !== null,
      };
    }),
  );
  return cards.sort((a, b) => a.name.localeCompare(b.name, "sk"));
}
