import { ApiError } from "@/server/api/errors";
import type { ClubPlanDoc } from "@/server/db/types";
import { getAnalytics, type AnalyticsDeps } from "@/server/services/analytics.service";
import { isAdmin } from "@/server/services/club-access";
import type { ContentStore } from "@/server/services/content.service";
import { seesMentor } from "@/server/services/hub.service";
import { clubMembers, isoToday, type StoredVisit } from "@/server/services/mentor-visit.service";
import type { RoleCatalog } from "@/server/services/role-catalog.schema";
import { getRoleCatalog, type RoleCatalogStore } from "@/server/services/role-catalog.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Network graph of the analysis workspace (DA-d, decisions 22. 10. 2026):
 * - Academy map: the 11 areas and the base roles, a role linked to the areas it works in
 *   (the role catalog), thicker where the area is among the role's first three;
 * - club map: the areas coloured by the club's Kompas, the club's tasks (agreed actions of sent
 *   mentor visits and goals of the season's plan, done ones too) on their areas, the roles of the
 *   club and – for management, the mentor and admin_sfz only – the people with their tasks.
 * The union mentor stays in the background (16. 10. 2026): its role and people only for mentors and
 * admin_sfz. Same access as the analysis (ADR 0003: one club, read through its clubId).
 */
export interface NetworkDeps extends AnalyticsDeps {
  content: Pick<ContentStore, "listAreas">;
  roleCatalog: Pick<RoleCatalogStore, "findCatalog">;
}

export type NetworkMap = "academy" | "club";
export type AreaLine = "goalkeeper" | "defense" | "midfield" | "attack";

export type NetworkNode =
  | {
      id: string;
      kind: "area";
      label: string;
      area: number;
      line: AreaLine;
      points?: number | null;
    }
  | { id: string; kind: "role"; label: string }
  | {
      id: string;
      kind: "task";
      label: string;
      task: "visit" | "goal";
      area: number | null;
      owner: string;
      dueDate: string | null;
      done: boolean;
      overdue: boolean;
      href: string;
    }
  | { id: string; kind: "person"; label: string };

export interface NetworkEdge {
  source: string;
  target: string;
  /** role → area: how many of the role's area roles sit in the area (1–3+) */
  weight?: number;
  /** role → area: the area is among the role's first three on the Hub */
  priority?: boolean;
}

export interface NetworkView {
  map: NetworkMap;
  club: { clubId: string; name: string } | null;
  /** person nodes are included */
  people: boolean;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

/** Formation 1-4-3-3 of the Academy (O Akadémii): goalkeeper 1, defence 8–11, midfield 2–4, attack 5–7. */
export function areaLine(area: number): AreaLine {
  if (area === 1) return "goalkeeper";
  if (area >= 8) return "defense";
  if (area <= 4) return "midfield";
  return "attack";
}

const areaId = (n: number) => `area:${n}`;
const roleId = (key: string) => `role:${key}`;

/** Pure: role → area edges of the catalog for the given base roles. */
function roleEdges(catalog: RoleCatalog, roles: readonly string[]): NetworkEdge[] {
  const hub = catalog.tracks?.flatMap((t) => t.hubRoles) ?? [];
  return roles.flatMap((role) => {
    const first = hub.find((h) => h.baseRole === role)?.order.slice(0, 3) ?? [];
    return catalog.areas.flatMap((a) => {
      const weight = a.roles.filter((r) => r.baseRoles.includes(role)).length;
      return weight > 0
        ? [
            {
              source: roleId(role),
              target: areaId(a.area),
              weight,
              priority: first.includes(a.area),
            },
          ]
        : [];
    });
  });
}

/** Pure: the Academy map – areas and base roles (no public-only roles, mentor when allowed). */
export function academyGraph(
  catalog: RoleCatalog,
  areas: readonly { number: number; name: string }[],
  withMentor: boolean,
): Pick<NetworkView, "nodes" | "edges"> {
  const roles = catalog.baseRoles.filter(
    (r) => !r.publicOnly && (withMentor || r.key !== "mentor"),
  );
  return {
    nodes: [
      ...areas.map((a) => ({
        id: areaId(a.number),
        kind: "area" as const,
        label: a.name,
        area: a.number,
        line: areaLine(a.number),
      })),
      ...roles.map((r) => ({ id: roleId(r.key), kind: "role" as const, label: r.name })),
    ],
    edges: roleEdges(
      catalog,
      roles.map((r) => r.key),
    ),
  };
}

export interface ClubGraphInput {
  clubId: string;
  catalog: RoleCatalog;
  areas: readonly { number: number; name: string }[];
  /** Kompas points of areas 1–11 (index 0 = area 1) */
  kompas: readonly (number | null)[];
  visits: readonly StoredVisit[];
  plan: ClubPlanDoc | null;
  members: readonly { userId: string; name: string; roles: readonly string[] }[];
  people: boolean;
  withMentor: boolean;
  today: string;
}

/** Pure: the club map – areas with Kompas, tasks, the club's roles and (optionally) its people. */
export function clubGraph(input: ClubGraphInput): Pick<NetworkView, "nodes" | "edges"> {
  const { clubId, catalog, today } = input;
  const club = encodeURIComponent(clubId);
  const overdue = (done: boolean, due: string | null) => !done && due !== null && due < today;
  const tasks = [
    ...input.visits
      .filter((v) => v.status === "sent")
      .flatMap((v) =>
        v.actions.map((a) => ({
          id: `visit:${v.id}:${a.id}`,
          kind: "task" as const,
          label: a.text,
          task: "visit" as const,
          area: a.area,
          owner: a.owner,
          ownerId: a.ownerId,
          dueDate: a.dueDate,
          done: a.done,
          overdue: overdue(a.done, a.dueDate),
          href: `/klub/${club}/navstevy/${encodeURIComponent(v.id)}`,
        })),
      ),
    ...(input.plan?.goals ?? []).map((g) => ({
      id: `goal:${g.id}`,
      kind: "task" as const,
      label: g.title,
      task: "goal" as const,
      area: g.area,
      owner: g.owner,
      ownerId: g.ownerId,
      dueDate: g.dueDate,
      done: g.status === "done",
      overdue: overdue(g.status === "done", g.dueDate),
      href: `/klub/${club}/plan`,
    })),
  ];
  // club roles (ADR 0004) shown through their base roles; the mentor only when allowed
  const members = input.members
    .map((m) => ({ ...m, roles: m.roles.filter((r) => input.withMentor || r !== "mentor") }))
    .filter((m) => m.roles.length > 0);
  const baseOf = (clubRole: string) => catalog.baseRoles.find((b) => b.clubRole === clubRole);
  const roles = [
    ...new Set(
      ["management", "coach", ...members.flatMap((m) => m.roles)].filter(
        (r) => input.withMentor || r !== "mentor",
      ),
    ),
  ]
    .map(baseOf)
    .filter((b) => b !== undefined);
  const memberIds = new Set(members.map((m) => m.userId));

  return {
    nodes: [
      ...input.areas.map((a) => ({
        id: areaId(a.number),
        kind: "area" as const,
        label: a.name,
        area: a.number,
        line: areaLine(a.number),
        points: input.kompas[a.number - 1] ?? null,
      })),
      ...roles.map((r) => ({ id: roleId(r.key), kind: "role" as const, label: r.name })),
      // the owner's id is internal – it only draws the person edge
      ...tasks.map(({ ownerId, ...t }) => {
        void ownerId;
        return { ...t, owner: input.people ? t.owner : "" };
      }),
      ...(input.people
        ? members.map((m) => ({ id: `person:${m.userId}`, kind: "person" as const, label: m.name }))
        : []),
    ],
    edges: [
      ...roleEdges(
        catalog,
        roles.map((r) => r.key),
      ),
      ...tasks.flatMap((t) => (t.area ? [{ source: t.id, target: areaId(t.area) }] : [])),
      ...(input.people
        ? [
            ...tasks.flatMap((t) =>
              t.ownerId && memberIds.has(t.ownerId)
                ? [{ source: `person:${t.ownerId}`, target: t.id }]
                : [],
            ),
            ...members.flatMap((m) =>
              m.roles.flatMap((r) => {
                const base = baseOf(r);
                return base ? [{ source: `person:${m.userId}`, target: roleId(base.key) }] : [];
              }),
            ),
          ]
        : []),
    ],
  };
}

export async function getNetwork(
  deps: NetworkDeps,
  actor: CurrentUser | null,
  request: { map: NetworkMap; clubId?: string | null },
): Promise<NetworkView> {
  const user = requireUser(actor);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  const memberships = await deps.memberships.listByUser(user.id);
  const withMentor = seesMentor(user, memberships, season);
  const [catalog, areas] = await Promise.all([
    getRoleCatalog(deps.roleCatalog, user),
    deps.content.listAreas(),
  ]);
  if (!catalog) throw new ApiError("NOT_FOUND", "Role catalog not seeded");
  const areaList = areas
    .map((a) => ({ number: a.number, name: a.shortName || a.name }))
    .sort((a, b) => a.number - b.number);

  if (request.map === "academy") {
    return {
      map: "academy",
      club: null,
      people: false,
      ...academyGraph(catalog.content, areaList, withMentor),
    };
  }

  // the analysis decides which clubs the user may see (and which Kompas: mentors the submitted one)
  const analysis = await getAnalytics(deps, user, {
    season,
    clubs: request.clubId ? [request.clubId] : null,
  });
  const club = analysis.scope === "club" || request.clubId ? analysis.clubs[0] : undefined;
  if (!club) throw new ApiError("NOT_FOUND", "Club not found or not visible");
  const managesClub = memberships.some(
    (m) => m.season === season && m.clubId === club.clubId && m.role === "management",
  );
  const people = isAdmin(user) || analysis.scope === "mentor" || managesClub;
  const [visits, plan, members] = await Promise.all([
    deps.visits.listVisits(club.clubId),
    deps.plans.findPlan(club.clubId, season),
    clubMembers(deps, club.clubId),
  ]);
  return {
    map: "club",
    club: { clubId: club.clubId, name: club.name },
    people,
    ...clubGraph({
      clubId: club.clubId,
      catalog: catalog.content,
      areas: areaList,
      kompas: club.kompas.areas,
      visits: visits.filter((v) => v.season === season),
      plan,
      members,
      people,
      withMentor,
      today: isoToday(now),
    }),
  };
}
