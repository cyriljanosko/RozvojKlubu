import "server-only";

import { SPORTNET_CORE_API_URL, type FetchLike } from "@/server/integrations/sportnet/me";

/**
 * Public CoreApi PPO endpoints (no token, ADR 0028). Read sequentially, never in parallel (B8).
 * Only the fields the app stores are typed; contact persons, e-mails and phones are ignored.
 */
export const SPORTNET_FEDERATION = "futbalsfz.sk";

export interface SportnetRelation {
  related_ppo?: string;
  type?: string;
  status?: string | null;
}

/** An item of `GET /ppo/{federation}/related-ppos?ppoType=club`. */
export interface SportnetClubPpo {
  _id: string;
  name?: string;
  organization_name?: string;
  type?: string;
  sport?: string;
  status?: string | null;
  logo_public_url?: string;
}

/** A node of `GET /ppo/{federation}/relations-structure`: federation → unions → clubs. */
export interface SportnetPpoNode {
  _id: string;
  name?: string;
  shortNames?: { shortname?: string }[];
  relations?: SportnetRelation[];
  subs?: SportnetPpoNode[];
}

export interface SportnetClubDirectory {
  clubs: SportnetClubPpo[];
  tree: SportnetPpoNode[];
}

/** The relations of `GET /ppo/{appSpace}` – where the club is registered (matricity). */
export interface SportnetClubProfile {
  relations: SportnetRelation[];
}

export interface SportnetLegalEntity {
  legalName?: string;
  businessId?: string;
  legalForm?: string;
}

type Options = { baseUrl?: string; fetch?: FetchLike };

async function getPublic(path: string, options: Options): Promise<unknown> {
  const base = (options.baseUrl ?? SPORTNET_CORE_API_URL).replace(/\/$/, "");
  const response = await (options.fetch ?? fetch)(`${base}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Sportnet ${path} responded with ${response.status}`);
  return response.json();
}

const itemsOf = <T>(body: unknown): T[] =>
  body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
    ? (body as { items: T[] }).items
    : [];

/** Every club of the federation and the union tree – two calls, one after the other. */
export async function fetchSportnetClubDirectory(
  options: Options = {},
): Promise<SportnetClubDirectory> {
  const clubs = itemsOf<SportnetClubPpo>(
    await getPublic(`/ppo/${SPORTNET_FEDERATION}/related-ppos?ppoType=club`, options),
  );
  const tree = itemsOf<SportnetPpoNode>(
    await getPublic(`/ppo/${SPORTNET_FEDERATION}/relations-structure`, options),
  );
  return { clubs, tree };
}

/** The club's own relations; the union tree places some clubs under the regional union only. */
export async function fetchSportnetClubProfile(
  appSpace: string,
  options: Options = {},
): Promise<SportnetClubProfile> {
  const body = (await getPublic(`/ppo/${encodeURIComponent(appSpace)}`, options)) as {
    relations?: unknown;
  };
  return { relations: Array.isArray(body.relations) ? (body.relations as SportnetRelation[]) : [] };
}

/** IČO, legal form and full name of the club's legal entity; nothing else of the invoice profile. */
export async function fetchSportnetLegalEntity(
  appSpace: string,
  options: Options = {},
): Promise<SportnetLegalEntity> {
  const body = (await getPublic(
    `/ppo/${encodeURIComponent(appSpace)}/invoice-profile`,
    options,
  )) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    legalName: text(body.name) ?? text(body.full_name),
    businessId: text(body.business_id),
    legalForm: text(body.legal_form),
  };
}
