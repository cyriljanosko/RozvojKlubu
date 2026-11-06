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
  const base = (options.baseUrl ?? SPORTNET_CORE_API_URL).replace(/\/$/, "");
  const response = await (options.fetch ?? fetch)(`${base}/me/appspaces`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Sportnet /me/appspaces responded with ${response.status}`);
  return (await response.json()) as SportnetMeAppspaces;
}
