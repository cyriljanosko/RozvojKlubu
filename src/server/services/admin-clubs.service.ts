import { z } from "zod";

import type { ClubDoc } from "@/server/db/types";
import { requireAdmin } from "@/server/services/club-access";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Club list of the administration (G5 Kluby, S3): search, filters and pages on the server – the
 * collection holds every active club from Sportnet (ADR 0028), too many for the browser.
 * Only admin_sfz. Pure orchestration; storage is injected.
 */

export const ADMIN_CLUBS_PAGE_SIZE = 25;
export const REGION_CODES = ["BFZ", "ZsFZ", "SsFZ", "VsFZ"] as const;
/** Region filter value for clubs without a regional union (futsal, SFZ, ÚLK, no matricity). */
export const NO_REGION = "none";

const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || undefined);

export const adminClubsQuerySchema = z.object({
  q: optionalText,
  region: z.enum([...REGION_CODES, NO_REGION]).optional(),
  /** appSpace of the registering union */
  union: optionalText,
  /** default: active clubs only */
  status: z.enum(["active", "inactive", "excluded", "all"]).default("active"),
  /** "V aplikácii": the club has data in the app (ADR 0028, ClubStore.listActiveClubIds) */
  inApp: z.enum(["yes", "no"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AdminClubsQuery = z.infer<typeof adminClubsQuerySchema>;

/** What the store filters by; `clubIds` narrows to (in) or away from (nin) clubs in the app. */
export interface AdminClubFilter {
  /** case- and diacritics-insensitive pattern for the name (see `searchPattern`) */
  namePattern?: string;
  /** IČO prefix when the search is a number */
  businessIdPrefix?: string;
  region?: AdminClubsQuery["region"];
  unionId?: string;
  status?: Exclude<AdminClubsQuery["status"], "all">;
  clubIds?: { in: string[] } | { nin: string[] };
}

export type AdminClubRecord = Pick<
  ClubDoc,
  | "clubId"
  | "name"
  | "union"
  | "region"
  | "status"
  | "logoUrl"
  | "unionId"
  | "legalName"
  | "businessId"
  | "legalForm"
  | "sportnetDetailsAt"
>;

export interface UnionOption {
  unionId: string;
  union: string;
  region: string;
}

export interface AdminClubStore {
  /** sorted by name (Slovak collation) */
  searchClubs: (
    filter: AdminClubFilter,
    page: { skip: number; limit: number },
  ) => Promise<{ clubs: AdminClubRecord[]; total: number }>;
  /** registering unions of active clubs, optionally in one region */
  listUnions: (region?: string) => Promise<UnionOption[]>;
  listActiveClubIds: () => Promise<string[]>;
}

export interface AdminClubView {
  clubId: string;
  name: string;
  legalName: string | null;
  legalForm: string | null;
  businessId: string | null;
  logoUrl: string | null;
  union: string;
  unionId: string | null;
  region: string;
  status: string | null;
  inApp: boolean;
  detailsAt: string | null;
}

export interface AdminClubList {
  clubs: AdminClubView[];
  /** options for the union filter (within the region filter, if any) */
  unions: UnionOption[];
  page: { page: number; pageSize: number; total: number; pages: number };
}

const LETTERS: Record<string, string> = {
  a: "aáä",
  c: "cč",
  d: "dď",
  e: "eéě",
  i: "ií",
  l: "lĺľ",
  n: "nň",
  o: "oóô",
  r: "rŕř",
  s: "sš",
  t: "tť",
  u: "uúů",
  y: "yý",
  z: "zž",
};
const BASE: Record<string, string> = Object.fromEntries(
  Object.entries(LETTERS).flatMap(([base, all]) => [...all].map((ch) => [ch, base])),
);

/**
 * Regex source matching `text` anywhere in a name regardless of Slovak diacritics
 * ("nova bana" finds "MFK Nová Baňa"); used with the case-insensitive flag.
 */
export function searchPattern(text: string): string {
  return [...text.toLowerCase()]
    .map((ch) => {
      const base = BASE[ch];
      if (base) return `[${LETTERS[base]}]`;
      return ch.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
    })
    .join("")
    .replace(/\s+/g, "\\s+");
}

/** Lists clubs for the administration (admin_sfz). */
export async function listAdminClubs(
  store: AdminClubStore,
  actor: CurrentUser | null,
  input: unknown,
): Promise<AdminClubList> {
  requireAdmin(requireUser(actor));
  const query = adminClubsQuerySchema.parse(input ?? {});

  const filter: AdminClubFilter = {
    ...(query.region && { region: query.region }),
    ...(query.union && { unionId: query.union }),
    ...(query.status !== "all" && { status: query.status }),
  };
  if (query.q) {
    const digits = query.q.replace(/\s/g, "");
    if (/^\d{2,}$/.test(digits)) filter.businessIdPrefix = digits;
    else filter.namePattern = searchPattern(query.q);
  }

  const activeIds = await store.listActiveClubIds();
  if (query.inApp) filter.clubIds = query.inApp === "yes" ? { in: activeIds } : { nin: activeIds };

  const skip = (query.page - 1) * ADMIN_CLUBS_PAGE_SIZE;
  const regionForUnions = query.region && query.region !== NO_REGION ? query.region : undefined;
  const [{ clubs, total }, unions] = await Promise.all([
    store.searchClubs(filter, { skip, limit: ADMIN_CLUBS_PAGE_SIZE }),
    store.listUnions(regionForUnions),
  ]);

  const inApp = new Set(activeIds);
  return {
    clubs: clubs.map((c) => ({
      clubId: c.clubId,
      name: c.name,
      legalName: c.legalName ?? null,
      legalForm: c.legalForm ?? null,
      businessId: c.businessId ?? null,
      logoUrl: c.logoUrl ?? null,
      union: c.union,
      unionId: c.unionId ?? null,
      region: c.region,
      status: c.status ?? null,
      inApp: inApp.has(c.clubId),
      detailsAt: c.sportnetDetailsAt?.toISOString() ?? null,
    })),
    unions,
    page: {
      page: query.page,
      pageSize: ADMIN_CLUBS_PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / ADMIN_CLUBS_PAGE_SIZE)),
    },
  };
}
