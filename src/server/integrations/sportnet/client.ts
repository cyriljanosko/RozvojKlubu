import "server-only";

import { ApiError } from "@/server/api/errors";
import { getEnv } from "@/server/env";

/**
 * Sportnet API client (server-only). Endpoints and auth will be filled in
 * during phase F2 once API access and documentation are confirmed.
 * Responses must be cached (Next.js revalidate) to protect Sportnet.
 */
export async function sportnetFetch<T>(
  path: string,
  init?: RequestInit & { revalidateSeconds?: number },
): Promise<T> {
  const { SPORTNET_API_URL, SPORTNET_API_KEY } = getEnv();
  if (!SPORTNET_API_URL || !SPORTNET_API_KEY) {
    throw new ApiError("SERVICE_UNAVAILABLE", "Sportnet integration is not configured");
  }

  const { revalidateSeconds = 300, ...rest } = init ?? {};
  const response = await fetch(new URL(path, SPORTNET_API_URL), {
    ...rest,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${SPORTNET_API_KEY}`,
      ...rest.headers,
    },
    next: { revalidate: revalidateSeconds },
  });

  if (response.status === 404) {
    throw new ApiError("NOT_FOUND", "Sportnet resource not found");
  }
  if (!response.ok) {
    throw new ApiError("SERVICE_UNAVAILABLE", `Sportnet responded with ${response.status}`);
  }
  return (await response.json()) as T;
}
