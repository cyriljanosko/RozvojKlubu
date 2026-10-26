import clubDistricts from "../../content/kluby-okresy.json";
import map from "../../content/mapa-sr.json";
import table from "../../content/obfz-okresy.json";

/**
 * Map of Slovakia for the Vizitky (VK-a, 26. 10. 2026): district shapes from geoBoundaries
 * (© OpenStreetMap contributors, ODbL) simplified to SVG, district → ObFZ → RFZ from
 * `content/obfz-okresy.json` (ObFZ list from Sportnet, districts to be reviewed by Cyril) and the
 * pilot clubs' districts from `content/kluby-okresy.json`.
 */
export type MapLevel = "rfz" | "obfz";
export const RFZ = ["BFZ", "ZsFZ", "SsFZ", "VsFZ"] as const;
export type Rfz = (typeof RFZ)[number];

export interface Obfz {
  id: string;
  rfz: Rfz;
  okresy: string[];
  check?: string[];
}

export const MAP_VIEWBOX: string = map.viewBox;
export const MAP_SOURCE: string = map.source;
export const OBFZ: Obfz[] = table.obfz as Obfz[];
const DISTRICTS: { id: string; kraj: string; path: string }[] = map.okresy;
const REGIONS: { id: string; rfz: string; path: string }[] = map.kraje;
const CLUB_DISTRICT: Record<string, string> = clubDistricts.clubs;

const obfzByDistrict = new Map(OBFZ.flatMap((o) => o.okresy.map((d) => [d, o] as const)));

export interface ClubPlace {
  district: string;
  obfz: string;
  rfz: Rfz;
}

/** Pure: where a club is – its district, ObFZ and RFZ; null when the club is not in the table. */
export function placeOf(clubId: string): ClubPlace | null {
  const district = CLUB_DISTRICT[clubId];
  const obfz = district ? obfzByDistrict.get(district) : undefined;
  return district && obfz ? { district, obfz: obfz.id, rfz: obfz.rfz } : null;
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
    if (!p) continue;
    const key = level === "rfz" ? p.rfz : p.obfz;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
