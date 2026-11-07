import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { ClubDoc } from "@/server/db/types";
import type {
  SportnetClubDirectory,
  SportnetClubPpo,
  SportnetClubProfile,
  SportnetLegalEntity,
  SportnetPpoNode,
  SportnetRelation,
} from "@/server/integrations/sportnet/ppo";
import { isAdmin } from "@/server/services/club-access";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Clubs from sportnet.online (S3, ADR 0028) in two steps, both dry-run by default:
 * 1. directory – every active football club of SFZ is created or refreshed (name, logo, status);
 * 2. details – one club after another: registering union and regional union from the club's own
 *    profile (the union tree places some clubs under the regional union only) and the legal entity.
 * Pure planning plus thin orchestration; I/O is injected.
 */

/** Regional unions – the `region` of a club. */
export const REGIONAL_UNIONS: readonly string[] = ["BFZ", "ZsFZ", "SsFZ", "VsFZ"];
const FEDERATION = "futbalsfz.sk";

const isActive = (status: string | null | undefined) => status === "active";

export interface UnionInfo {
  /** short name (`shortNames`), else the full name */
  name: string;
  /** regional union of the union; "" for ÚLK and other unions outside the regions */
  regionId: string;
}

const regionalMatricity = (relations: readonly SportnetRelation[] | undefined) =>
  (relations ?? []).find(
    (r) =>
      r.type === "matricity" && isActive(r.status) && REGIONAL_UNIONS.includes(r.related_ppo ?? ""),
  )?.related_ppo;

/** Unions of the federation (first level of the relations tree) with their names and regions. */
export function unionIndex(tree: readonly SportnetPpoNode[]): Map<string, UnionInfo> {
  const unions = new Map<string, UnionInfo>();
  for (const federation of tree) {
    unions.set(federation._id, { name: "SFZ", regionId: "" });
    for (const u of federation.subs ?? []) {
      const short = u.shortNames?.find((s) => s.shortname?.trim())?.shortname?.trim();
      unions.set(u._id, {
        name: short || u.name?.trim() || u._id,
        regionId: REGIONAL_UNIONS.includes(u._id) ? u._id : (regionalMatricity(u.relations) ?? ""),
      });
    }
  }
  return unions;
}

export interface ClubUnion {
  unionId: string;
  union: string;
  regionId: string;
}

/**
 * The registering union (matricity): an ObFZ-level union before a regional union before SFZ.
 * Region: the regional matricity, else the union's region, else any active link to a regional union.
 */
export function clubUnionOf(
  profile: SportnetClubProfile,
  unions: ReadonlyMap<string, UnionInfo>,
): ClubUnion | null {
  const active = profile.relations.filter((r) => isActive(r.status) && r.related_ppo);
  const matricity = active.filter((r) => r.type === "matricity").map((r) => r.related_ppo!);
  const unionId =
    matricity.find((id) => id !== FEDERATION && !REGIONAL_UNIONS.includes(id)) ??
    matricity.find((id) => REGIONAL_UNIONS.includes(id)) ??
    matricity.find((id) => id === FEDERATION);
  if (!unionId) return null;
  const regionId =
    regionalMatricity(profile.relations) ??
    (unions.get(unionId)?.regionId || undefined) ??
    active.map((r) => r.related_ppo!).find((id) => REGIONAL_UNIONS.includes(id)) ??
    "";
  return { unionId, union: unions.get(unionId)?.name ?? unionId, regionId };
}

// ---- 1. directory ----

/** Fields the directory step owns; union, region, slug and season data stay. */
export type SportnetClubFields = Pick<ClubDoc, "name" | "status" | "sportnetSyncedAt"> & {
  logoUrl?: string;
};

export interface ClubImportPlan {
  create: ClubDoc[];
  update: { clubId: string; set: SportnetClubFields }[];
  /** stored clubs whose name, status or logo differ from Sportnet (all stored ones are written) */
  changed: number;
  /** Sportnet clubs skipped: not active (and not stored) or not football */
  skipped: number;
}

const fieldsOf = (ppo: SportnetClubPpo, now: Date): SportnetClubFields => ({
  name: ppo.name?.trim() || ppo.organization_name?.trim() || ppo._id,
  status: ppo.status ?? "active",
  ...(ppo.logo_public_url ? { logoUrl: ppo.logo_public_url } : {}),
  sportnetSyncedAt: now,
});

/** What the directory step compares; older callers may know only the ID. */
export type StoredClub = Pick<ClubDoc, "clubId"> &
  Partial<Pick<ClubDoc, "name" | "status" | "logoUrl">>;

/**
 * Active football clubs are created or refreshed. Stored clubs that are no longer active in
 * Sportnet keep their record (memberships, Kompas) and get the new status.
 */
export function planClubImport(input: {
  clubs: readonly SportnetClubPpo[];
  existing: readonly StoredClub[];
  now: Date;
}): ClubImportPlan {
  const byId = new Map(input.existing.map((c) => [c.clubId, c]));
  const stored = new Set(byId.keys());
  const plan: ClubImportPlan = { create: [], update: [], changed: 0, skipped: 0 };
  const seen = new Set<string>();
  for (const ppo of input.clubs) {
    if (!ppo._id || seen.has(ppo._id)) continue;
    seen.add(ppo._id);
    const football = ppo.type === "club" && (ppo.sport ?? "futbal") === "futbal";
    if (!football || (!isActive(ppo.status) && !stored.has(ppo._id))) {
      plan.skipped += 1;
      continue;
    }
    const set = fieldsOf(ppo, input.now);
    const current = byId.get(ppo._id);
    if (current) {
      plan.update.push({ clubId: ppo._id, set });
      if (
        current.name !== set.name ||
        current.status !== set.status ||
        (current.logoUrl ?? undefined) !== set.logoUrl
      ) {
        plan.changed += 1;
      }
    } else {
      plan.create.push({
        clubId: ppo._id,
        union: "",
        region: "",
        slug: "",
        source: "sportnet",
        dataAsOf: input.now.toISOString().slice(0, 10),
        importedAt: input.now,
        ...set,
      });
    }
  }
  return plan;
}

// ---- stores and deps ----

export type ClubDetails = Pick<ClubDoc, "union" | "region" | "unionId" | "regionId"> &
  SportnetLegalEntity & { sportnetDetailsAt: Date };

export interface ClubImportStore {
  listClubsForImport: () => Promise<StoredClub[]>;
  applyClubImport: (plan: Pick<ClubImportPlan, "create" | "update">) => Promise<void>;
  /** active Sportnet clubs without details yet (clubs used in the app first), at most `limit` */
  listClubsWithoutDetails: (
    limit: number,
  ) => Promise<Pick<ClubDoc, "clubId" | "name" | "union" | "region">[]>;
  countClubsWithoutDetails: () => Promise<number>;
  /** active clubs for the nightly refresh: without details first, then the oldest details */
  listClubsForRefresh: (
    limit: number,
  ) => Promise<Pick<ClubDoc, "clubId" | "name" | "union" | "region">[]>;
  setClubDetails: (clubId: string, details: ClubDetails) => Promise<void>;
}

export interface ClubImportDeps {
  store: ClubImportStore;
  fetchDirectory: () => Promise<SportnetClubDirectory>;
  fetchProfile: (clubId: string) => Promise<SportnetClubProfile>;
  fetchLegalEntity: (clubId: string) => Promise<SportnetLegalEntity>;
  now?: () => Date;
}

function requireAdmin(actor: CurrentUser | null) {
  const user = requireUser(actor);
  if (!isAdmin(user)) throw new ApiError("FORBIDDEN", "Only admin_sfz imports clubs");
  return user;
}

export const clubImportInputSchema = z.object({ apply: z.boolean().default(false) });

export interface ClubImportResult {
  applied: boolean;
  sportnetClubs: number;
  created: number;
  updated: number;
  skipped: number;
}

/** Step 1. Dry-run by default; `apply: true` writes (admin_sfz). */
export async function importSportnetClubs(
  deps: ClubImportDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<ClubImportResult> {
  requireAdmin(actor);
  const { apply } = clubImportInputSchema.parse(input ?? {});
  const { clubs } = await deps.fetchDirectory();
  const plan = planClubImport({
    clubs,
    existing: await deps.store.listClubsForImport(),
    now: deps.now?.() ?? new Date(),
  });
  if (apply) await deps.store.applyClubImport(plan);
  return {
    applied: apply,
    sportnetClubs: clubs.length,
    created: plan.create.length,
    updated: plan.changed,
    skipped: plan.skipped,
  };
}

// ---- 2. details ----

export const clubDetailsInputSchema = z.object({
  apply: z.boolean().default(false),
  limit: z.number().int().min(1).max(150).default(50),
});

export interface ClubDetailsResult {
  applied: boolean;
  checked: number;
  failed: number;
  /** clubs left without details after this call (before it on a dry-run) */
  remaining: number;
  /** clubs of this batch whose union changes */
  unionChanges: { clubId: string; name: string; from: string; to: string; region: string }[];
}

/**
 * Step 2. Two Sportnet calls per club, sequentially (B8), at most `limit` clubs per request so it
 * fits the function time; call again until `remaining` is 0. The dry-run reads the same batch and
 * shows the union changes without writing. A club that fails is skipped and tried next time.
 */
type DetailsBatch = Pick<ClubDetailsResult, "checked" | "failed" | "unionChanges">;

/** Reads (and with `apply` writes) the details of the clubs one after another until `until`. */
async function readClubDetails(
  deps: ClubImportDeps,
  unions: ReadonlyMap<string, UnionInfo>,
  batch: readonly Pick<ClubDoc, "clubId" | "name" | "union" | "region">[],
  apply: boolean,
  until = Number.POSITIVE_INFINITY,
): Promise<DetailsBatch> {
  const result: DetailsBatch = { checked: 0, failed: 0, unionChanges: [] };
  for (const club of batch) {
    if (Date.now() >= until) break;
    try {
      const union = clubUnionOf(await deps.fetchProfile(club.clubId), unions);
      const legal = await deps.fetchLegalEntity(club.clubId);
      const details: ClubDetails = {
        // without an active matricity the club keeps its stored union and region
        union: union?.union ?? club.union,
        region: union ? union.regionId : club.region,
        unionId: union?.unionId ?? "",
        regionId: union?.regionId ?? "",
        ...legal,
        sportnetDetailsAt: deps.now?.() ?? new Date(),
      };
      if (details.union !== club.union) {
        result.unionChanges.push({
          clubId: club.clubId,
          name: club.name,
          from: club.union,
          to: details.union,
          region: details.region,
        });
      }
      if (apply) await deps.store.setClubDetails(club.clubId, details);
      result.checked += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

export async function fillClubDetails(
  deps: ClubImportDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<ClubDetailsResult> {
  requireAdmin(actor);
  const { apply, limit } = clubDetailsInputSchema.parse(input ?? {});
  const unions = unionIndex((await deps.fetchDirectory()).tree);
  const batch = await deps.store.listClubsWithoutDetails(limit);
  const read = await readClubDetails(deps, unions, batch, apply);
  return { applied: apply, ...read, remaining: await deps.store.countClubsWithoutDetails() };
}

// ---- 3. nightly sync (Vercel Cron, ADR 0029) ----

/** Clubs whose Sportnet details one nightly run refreshes (ADR 0029). */
export const CLUB_DETAILS_PER_RUN = 600;

export interface ClubSyncResult extends Omit<ClubImportResult, "applied"> {
  checked: number;
  failed: number;
  unionChanges: number;
  /** clubs still without details after the run */
  remaining: number;
}

/**
 * Nightly sync without a user (the cron route checks its secret): the directory step and the
 * details of at most `limit` clubs – new ones first, then the oldest – within `budgetMs`, so the
 * run fits the function time. Writes unless `apply: false` (manual dry-run, ADR 0030).
 */
export async function syncSportnetClubs(
  deps: ClubImportDeps,
  options: { limit?: number; budgetMs?: number; apply?: boolean } = {},
): Promise<ClubSyncResult> {
  const apply = options.apply ?? true;
  const until = Date.now() + (options.budgetMs ?? 240_000);
  const directory = await deps.fetchDirectory();
  const plan = planClubImport({
    clubs: directory.clubs,
    existing: await deps.store.listClubsForImport(),
    now: deps.now?.() ?? new Date(),
  });
  if (apply) await deps.store.applyClubImport(plan);
  const batch = await deps.store.listClubsForRefresh(options.limit ?? CLUB_DETAILS_PER_RUN);
  const read = await readClubDetails(deps, unionIndex(directory.tree), batch, apply, until);
  return {
    sportnetClubs: directory.clubs.length,
    created: plan.create.length,
    updated: plan.changed,
    skipped: plan.skipped,
    checked: read.checked,
    failed: read.failed,
    unionChanges: read.unionChanges.length,
    remaining: await deps.store.countClubsWithoutDetails(),
  };
}
