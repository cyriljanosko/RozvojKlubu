import { placeOf, type ClubPlace } from "@/lib/slovakia-map";
import type { ClubSize } from "@/server/services/analytics.service";
import { getPublicVizitka, type VizitkaDeps } from "@/server/services/vizitka.service";

/**
 * Public list of club Vizitky for the map (VK-a, decisions 26. 10. 2026): the pilot clubs with
 * where they are (district → ObFZ → RFZ), their size and whether the Kompas was submitted and the
 * licensing closed – only what the public Vizitka already shows, no sign-in needed.
 */
export interface VizitkaCard {
  clubId: string;
  name: string;
  /** union of the competitions (Sportnet), e.g. "ObFZ Trebišov" or "SFZ" */
  union: string;
  place: ClubPlace | null;
  size: ClubSize | null;
  players: number | null;
  /** points of the submitted Kompas (0–220), null when not submitted */
  kompas: number | null;
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
        licensingClosed: v.licensing !== null,
      };
    }),
  );
  return cards.sort((a, b) => a.name.localeCompare(b.name, "sk"));
}
