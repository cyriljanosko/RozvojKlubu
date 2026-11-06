import clubDistricts from "../../content/kluby-okresy.json";
import map from "../../content/mapa-zvazov.json";
import table from "../../content/obfz-okresy.json";

/**
 * Map of Slovakia for the Vizitky: the territories of the 4 RFZ and 38 ObFZ from the SFZ project
 * statistika.futbalsfz.sk (`content/mapa-zvazov.json`, 6. 11. 2026 – ObFZ borders do not follow
 * districts). ObFZ list with RFZ and Sportnet ids in `content/obfz-okresy.json`; the pilot clubs'
 * districts in `content/kluby-okresy.json`. Other clubs are placed by their
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
const RFZ_SHAPES = new Map(map.rfz.map((r) => [r.id, r.path]));
const OBFZ_SHAPES = new Map(map.obfz.map((o) => [o.id, o.path]));
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
  /** SVG paths drawn with the same colour (the territory of the union) */
  paths: string[];
}

const shape = (path: string | undefined) => (path ? [path] : []);

/** Pure: the areas drawn for a level – the territories of the RFZ or of the ObFZ. */
export function mapAreas(level: MapLevel): MapArea[] {
  if (level === "rfz") {
    return RFZ.map((rfz) => ({ id: rfz, rfz, paths: shape(RFZ_SHAPES.get(rfz)) }));
  }
  return OBFZ.map((o) => ({ id: o.id, rfz: o.rfz, paths: shape(OBFZ_SHAPES.get(o.id)) }));
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
