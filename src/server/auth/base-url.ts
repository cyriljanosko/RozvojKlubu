/**
 * Base URL for Better Auth (magic links, OAuth callbacks, origin checks).
 * Pure module so it can be unit-tested without the auth instance.
 */
export type AuthBaseURL = string | { allowedHosts: string[]; protocol: "https"; fallback: string };

export interface BaseURLEnv {
  APP_URL: string;
  BETTER_AUTH_URL?: string;
  VERCEL_ENV?: string;
  /** Deployment hostname without protocol, set by Vercel. */
  VERCEL_URL?: string;
  /** Branch alias hostname without protocol, set by Vercel for Git deployments. */
  VERCEL_BRANCH_URL?: string;
}

/**
 * Explicit BETTER_AUTH_URL wins. On Vercel Preview the URL follows the deployment
 * (branch alias first), limited to this deployment's own hosts – never a wildcard,
 * which would trust any *.vercel.app site. Otherwise APP_URL.
 */
export function resolveAuthBaseURL(env: BaseURLEnv): AuthBaseURL {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;

  if (env.VERCEL_ENV === "preview") {
    const hosts = [env.VERCEL_BRANCH_URL, env.VERCEL_URL].filter((h): h is string => Boolean(h));
    if (hosts.length > 0) {
      return { allowedHosts: hosts, protocol: "https", fallback: `https://${hosts[0]}` };
    }
  }

  return env.APP_URL;
}
