import "server-only";

/**
 * CoreApi `/me/*` with the signed-in user's Sportnet access token (A7: the token from sign-in
 * works without token exchange). Shape of `/me/appspaces` per sportnet.online B4
 * (docs/sportnet/odpovede-sportnet-online.md, part 3).
 */
export const SPORTNET_CORE_API_URL = "https://api.sportnet.online/v1";

export interface SportnetOrgProfile {
  _id: string;
  name?: string;
  type?: string;
  sport?: string;
  status?: string;
  parent_ppo?: string;
}

export interface SportnetAppspace {
  app_id: string;
  app_space: string;
  role?: string;
  validTo?: string | null;
  org_profile?: SportnetOrgProfile;
}

export interface SportnetMeAppspaces {
  apps?: { app_id: string; appspaces?: SportnetAppspace[] }[];
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function fetchMyAppspaces(
  accessToken: string,
  options: { baseUrl?: string; fetch?: FetchLike } = {},
): Promise<SportnetMeAppspaces> {
  return (await getMe("/me/appspaces", accessToken, options)) as SportnetMeAppspaces;
}

/** One affiliation of `/me/sport-orgs` or `/me/sport-expert-orgs` (ADR 0021, B5). */
export interface SportnetAffiliation {
  _id?: string;
  org_profile_id?: string;
  competence_type?: string;
  /** computed by CoreApi from date_from/date_to (B5) */
  isActive?: boolean;
  date_from?: string | null;
  date_to?: string | null;
}

/** The list in a CoreApi answer: a bare array or the first array property of the object. */
export function affiliationsOf(body: unknown): SportnetAffiliation[] {
  if (Array.isArray(body)) return body as SportnetAffiliation[];
  if (body && typeof body === "object") {
    const list = Object.values(body).find(Array.isArray);
    if (list) return list as SportnetAffiliation[];
  }
  return [];
}

async function getMe(
  path: string,
  accessToken: string,
  options: { baseUrl?: string; fetch?: FetchLike },
) {
  const base = (options.baseUrl ?? SPORTNET_CORE_API_URL).replace(/\/$/, "");
  const response = await (options.fetch ?? fetch)(`${base}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Sportnet ${path} responded with ${response.status}`);
  return response.json();
}

export async function fetchMyAffiliations(
  accessToken: string,
  options: { baseUrl?: string; fetch?: FetchLike } = {},
): Promise<{ sportOrgs: SportnetAffiliation[]; sportExpertOrgs: SportnetAffiliation[] }> {
  // sequential, not parallel (B8)
  const sportOrgs = affiliationsOf(await getMe("/me/sport-orgs", accessToken, options));
  const sportExpertOrgs = affiliationsOf(
    await getMe("/me/sport-expert-orgs", accessToken, options),
  );
  return { sportOrgs, sportExpertOrgs };
}
