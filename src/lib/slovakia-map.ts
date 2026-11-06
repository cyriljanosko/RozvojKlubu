import clubDistricts from "../../content/kluby-okresy.json";
import map from "../../content/mapa-sr.json";
import table from "../../content/obfz-okresy.json";

/**
 * Map of Slovakia for the Vizitky (VK-a, 26. 10. 2026): district shapes from geoBoundaries
 * (© OpenStreetMap contributors, ODbL) simplified to SVG, district → ObFZ → RFZ from
 * `content/obfz-okresy.json` (ObFZ list from Sportnet, districts reviewed by Cyril) and the
 * pilot clubs' districts from `content/kluby-okresy.json`. Other clubs are placed by their
 * registering union from Sportnet (S3, ADR 0028): an ObFZ gives ObFZ and RFZ, a regional union
 * only the RFZ.
 */
export type MapLevel = "rfz" | "obfz";
export const RFZ = ["BFZ", "ZsFZ", "SsFZ", "VsFZ"] as const;
export type Rfz = (typeof RFZ)[number];

export interface Obfz {
  id: string;
  /** appSpace of the union in Sportnet (`clubs.unionId`) */
  sportnetId: string;
  rfz: Rfz;
  okresy: string[];
}

export const MAP_VIEWBOX: string = map.viewBox;
export const MAP_SOURCE: string = map.source;
export const OBFZ: Obfz[] = table.obfz as Obfz[];
const DISTRICTS: { id: string; kraj: string; path: string }[] = map.okresy;
const REGIONS: { id: string; rfz: string; path: string }[] = map.kraje;
const CLUB_DISTRICT: Record<string, string> = clubDistricts.clubs;

const obfzByDistrict = new Map(OBFZ.flatMap((o) => o.okresy.map((d) => [d, o] as const)));
const obfzBySportnetId = new Map(OBFZ.map((o) => [o.sportnetId, o] as const));
const isRfz = (id: string | undefined): id is Rfz => (RFZ as readonly string[]).includes(id ?? "");

export interface ClubPlace {
  /** only for the pilot clubs (`content/kluby-okresy.json`) */
  district?: string;
  /** null for a club registered directly with the regional union */
  obfz: string | null;
  rfz: Rfz;
}

/**
 * Pure: where a club is – the district of a pilot club, else its registering union from Sportnet
 * (ObFZ → ObFZ and RFZ; regional union → RFZ only); null when neither is known (SFZ, ÚLK, futsal).
 */
export function placeOf(club: {
  clubId: string;
  unionId?: string;
  regionId?: string;
}): ClubPlace | null {
  const district = CLUB_DISTRICT[club.clubId];
  const byDistrict = district ? obfzByDistrict.get(district) : undefined;
  if (district && byDistrict) return { district, obfz: byDistrict.id, rfz: byDistrict.rfz };
  const obfz = club.unionId ? obfzBySportnetId.get(club.unionId) : undefined;
  if (obfz) return { obfz: obfz.id, rfz: obfz.rfz };
  if (isRfz(club.unionId)) return { obfz: null, rfz: club.unionId };
  return null;
}

export interface MapArea {
  /** RFZ code or ObFZ name – the value of the filter */
  id: string;
  rfz: Rfz;
  /** SVG paths drawn with the same colour (regions of an RFZ, districts of an ObFZ) */
  paths: string[];
}

/** Pure: the areas drawn for a level – RFZ from the regions (kraje), ObFZ from districts. */
export function mapAreas(level: MapLevel): MapArea[] {
  if (level === "rfz") {
    return RFZ.map((rfz) => ({
      id: rfz,
      rfz,
      paths: REGIONS.filter((r) => r.rfz === rfz).map((r) => r.path),
    }));
  }
  const paths = new Map(DISTRICTS.map((d) => [d.id, d.path]));
  return OBFZ.map((o) => ({
    id: o.id,
    rfz: o.rfz,
    paths: o.okresy.map((d) => paths.get(d)).filter((p): p is string => p !== undefined),
  }));
}

/** Pure: how many clubs fall into each area of a level. */
export function countByArea(
  places: readonly (ClubPlace | null)[],
  level: MapLevel,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of places) {
    const key = level === "rfz" ? p?.rfz : p?.obfz;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
