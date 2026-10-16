import { clubRolesFor } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import { listPublicClubs } from "@/server/services/clubs.service";
import type { ContentStore } from "@/server/services/content.service";
import { clubCategories, type ClubCategory } from "@/server/services/kompas-scoring";
import { profileFromSeason, sizeLabel } from "@/server/services/kompas-export";
import type { HubRole, RoleCatalog, Track } from "@/server/services/role-catalog.schema";
import { getRoleCatalog, type RoleCatalogStore } from "@/server/services/role-catalog.service";
import { currentSeason } from "@/server/services/season";
import type { CurrentUser } from "@/server/services/users.service";

/**
 * Public Hub (ADR 0011): a track, a role lens and an optional club reorder the 11 areas,
 * add a sentence per area for the role and a "Začnite tu" box. Works without sign-in;
 * a signed-in user gets the role and club of their membership as defaults.
 */
export interface HubDeps extends ClubDeps {
  content: Pick<ContentStore, "listAreas">;
  roleCatalog: Pick<RoleCatalogStore, "findCatalog">;
}

export interface HubArea {
  number: number;
  name: string;
  band: 1 | 2 | 3;
  teaser: string;
  /** sentence for the selected role, if any */
  line: string | null;
  /** one of the role's areas (shown first) */
  forRole: boolean;
  /** false on a track in preparation (no detail yet) */
  hasDetail: boolean;
}

export interface HubSelection {
  track?: string | null;
  role?: string | null;
  club?: string | null;
}

export interface HubView {
  tracks: { key: string; name: string; status: Track["status"] }[];
  track: { key: string; name: string; status: Track["status"]; intro: string };
  roles: { key: string; name: string }[];
  role: Pick<HubRole, "key" | "name" | "info" | "start" | "draft"> & { whole: boolean };
  areas: HubArea[];
  clubs: { clubId: string; name: string; union: string }[];
  club: {
    clubId: string;
    name: string;
    union: string;
    region: string;
    season: string;
    size: "small" | "medium" | "large";
    teams: number;
    players: number;
    coaches: number;
    categories: ClubCategory[];
  } | null;
  /** where the defaults came from */
  defaultsFrom: "url" | "membership" | "none";
}

const SIZE = { malý: "small", stredný: "medium", veľký: "large" } as const;

/** Pure: areas of the role first (in the role's order), the rest by number. */
export function orderAreas<T extends { number: number }>(
  areas: readonly T[],
  order: readonly number[],
): (T & { forRole: boolean })[] {
  const first = order
    .map((n) => areas.find((a) => a.number === n))
    .filter((a): a is T => a !== undefined)
    .map((a) => ({ ...a, forRole: true }));
  const rest = areas
    .filter((a) => !order.includes(a.number))
    .sort((a, b) => a.number - b.number)
    .map((a) => ({ ...a, forRole: false }));
  return [...first, ...rest];
}

/** Pure: the Hub role lens for a club role (management → management lens, …). */
export function lensForClubRoles(track: Track, roles: readonly string[]): HubRole | null {
  for (const r of ["management", "coach", "mentor"]) {
    if (!roles.includes(r)) continue;
    const lens = track.hubRoles.find((h) => h.baseRole === r);
    if (lens) return lens;
  }
  return null;
}

/** Pure: Prax role of an area for a Hub role key (Hub role → base role → area role with Prax). */
export function practiceRoleForHubRole(
  catalog: RoleCatalog,
  area: number,
  hubRoleKey: string,
): string | null {
  const lens = (catalog.tracks ?? []).flatMap((t) => t.hubRoles).find((h) => h.key === hubRoleKey);
  if (!lens?.baseRole) return null;
  const roles = catalog.areas.find((a) => a.area === area)?.roles ?? [];
  return (
    roles.find((r) => r.practiceRole && r.baseRoles.includes(lens.baseRole!))?.practiceRole ?? null
  );
}

/** Pure: base role for a role in the address – a Hub role ("coach"), a Prax role ("t") or a base role. */
export function baseRoleForParam(
  catalog: RoleCatalog,
  area: number,
  param: string | null | undefined,
): string | null {
  if (!param) return null;
  if (catalog.baseRoles.some((b) => b.key === param)) return param;
  const lens = (catalog.tracks ?? []).flatMap((t) => t.hubRoles).find((h) => h.key === param);
  if (lens) return lens.baseRole ?? null;
  const areaRole = catalog.areas
    .find((a) => a.area === area)
    ?.roles.find((r) => r.practiceRole === param);
  return areaRole?.baseRoles[0] ?? null;
}

/** Pure: Metodika for a role (ADR 0011) – intro ("all") first, then the role's sections, then the rest. */
export function orderSections<T extends { key: string }>(
  sections: readonly T[],
  tags: Record<string, string[]> | undefined,
  baseRole: string | null,
): (T & { forRole: boolean })[] {
  const tagged = (s: T, role: string) => (tags?.[s.key] ?? []).includes(role);
  if (!baseRole) return sections.map((s) => ({ ...s, forRole: false }));
  const intro = sections.filter((s) => tagged(s, "all"));
  const mine = sections.filter((s) => !tagged(s, "all") && tagged(s, baseRole));
  const rest = sections.filter((s) => !tagged(s, "all") && !tagged(s, baseRole));
  return [
    ...intro.map((s) => ({ ...s, forRole: false })),
    ...mine.map((s) => ({ ...s, forRole: true })),
    ...rest.map((s) => ({ ...s, forRole: false })),
  ];
}

function pickTrack(catalog: RoleCatalog, key?: string | null): Track | null {
  const tracks = catalog.tracks ?? [];
  return tracks.find((t) => t.key === key) ?? tracks[0] ?? null;
}

export async function getHub(
  deps: HubDeps,
  actor: CurrentUser | null,
  selection: HubSelection,
): Promise<HubView | null> {
  const catalog = (await getRoleCatalog(deps.roleCatalog, actor))?.content;
  const track = catalog ? pickTrack(catalog, selection.track) : null;
  if (!catalog || !track) return null;

  const clubs = (await listPublicClubs(deps)).map((c) => ({
    clubId: c.clubId,
    name: c.name,
    union: c.union,
  }));
  const season = currentSeason(deps.now?.() ?? new Date());

  // defaults for signed-in users: role lens and club from their membership
  let defaultsFrom: HubView["defaultsFrom"] = selection.role || selection.club ? "url" : "none";
  let roleKey = selection.role ?? null;
  let clubId = selection.club ?? null;
  if (actor && (!roleKey || !clubId)) {
    const memberships = (await deps.memberships.listByUser(actor.id)).filter(
      (m) => m.season === season,
    );
    const own = memberships.find((m) => m.role !== "mentor") ?? memberships[0];
    if (own) {
      const lens = lensForClubRoles(track, clubRolesFor(memberships, own.clubId, season));
      if (!roleKey && lens) roleKey = lens.key;
      if (!clubId && track.status === "approved") clubId = own.clubId;
      if (defaultsFrom === "none") defaultsFrom = "membership";
    }
  }
  const lens =
    track.hubRoles.find((h) => h.key === roleKey) ??
    track.hubRoles.find((h) => h.order.length === 0) ??
    track.hubRoles[0];

  const base =
    track.status === "approved"
      ? (await deps.content.listAreas()).map((a) => ({
          number: a.number,
          name: a.name,
          band: a.band,
          teaser: track.teasers?.[String(a.number)] ?? a.description,
          hasDetail: true,
        }))
      : (track.areas ?? []).map((a) => ({
          number: a.area,
          name: a.name,
          band: a.band as 1 | 2 | 3,
          teaser: a.description,
          hasDetail: false,
        }));
  const areas: HubArea[] = orderAreas(base, lens.order).map((a) => ({
    ...a,
    line: lens.lines[String(a.number)] ?? null,
  }));

  let club: HubView["club"] = null;
  const pickedClub =
    track.status === "approved" && clubId ? await deps.clubs.findClub(clubId) : null;
  if (pickedClub) {
    const seasons = (await deps.clubs.listSeasonNames(pickedClub.clubId)).sort().reverse();
    const s = seasons.includes(season) ? season : seasons[0];
    const data = s ? await deps.clubs.findSeason(pickedClub.clubId, s) : null;
    const p = profileFromSeason(data);
    club = {
      clubId: pickedClub.clubId,
      name: pickedClub.name,
      union: pickedClub.union,
      region: pickedClub.region,
      season: s ?? season,
      size: SIZE[sizeLabel(p.youth, p.adults)],
      teams: p.teams,
      players: p.youth + p.adults,
      coaches: p.coaches,
      categories: data ? clubCategories(data.teams) : [],
    };
  }

  return {
    tracks: (catalog.tracks ?? []).map((t) => ({ key: t.key, name: t.name, status: t.status })),
    track: { key: track.key, name: track.name, status: track.status, intro: track.intro },
    roles: track.hubRoles.map((h) => ({ key: h.key, name: h.name })),
    role: {
      key: lens.key,
      name: lens.name,
      info: lens.info,
      start: lens.start,
      draft: lens.draft,
      whole: lens.order.length === 0,
    },
    areas,
    clubs,
    club,
    defaultsFrom,
  };
}
