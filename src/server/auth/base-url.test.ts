import { describe, expect, it } from "vitest";

import { resolveAuthBaseURL } from "./base-url";

describe("resolveAuthBaseURL", () => {
  it("uses BETTER_AUTH_URL when it is set", () => {
    expect(
      resolveAuthBaseURL({
        BETTER_AUTH_URL: "https://rozvojklubu.ltk.solutions",
        APP_URL: "http://localhost:3000",
        VERCEL_ENV: "preview",
        VERCEL_URL: "rozvojklubu-abc123-cyro5.vercel.app",
      }),
    ).toBe("https://rozvojklubu.ltk.solutions");
  });

  // Bug 2026-10-16: on Vercel Preview (no BETTER_AUTH_URL) magic links and callbacks
  // pointed to the APP_URL default http://localhost:3000 instead of the deployment.
  it("uses the deployment hosts on Vercel Preview", () => {
    expect(
      resolveAuthBaseURL({
        APP_URL: "http://localhost:3000",
        VERCEL_ENV: "preview",
        VERCEL_URL: "rozvojklubu-abc123-cyro5.vercel.app",
        VERCEL_BRANCH_URL: "rozvojklubu-git-fix-x-cyro5.vercel.app",
      }),
    ).toEqual({
      allowedHosts: [
        "rozvojklubu-git-fix-x-cyro5.vercel.app",
        "rozvojklubu-abc123-cyro5.vercel.app",
      ],
      protocol: "https",
      fallback: "https://rozvojklubu-git-fix-x-cyro5.vercel.app",
    });
  });

  it("never trusts other Vercel deployments by wildcard", () => {
    const config = resolveAuthBaseURL({
      APP_URL: "http://localhost:3000",
      VERCEL_ENV: "preview",
      VERCEL_URL: "rozvojklubu-abc123-cyro5.vercel.app",
    });
    expect(config).toMatchObject({ allowedHosts: ["rozvojklubu-abc123-cyro5.vercel.app"] });
    expect(JSON.stringify(config)).not.toContain("*");
  });

  it("falls back to APP_URL outside Vercel Preview", () => {
    expect(
      resolveAuthBaseURL({
        APP_URL: "http://localhost:3000",
        VERCEL_ENV: "production",
        VERCEL_URL: "rozvojklubu-abc123-cyro5.vercel.app",
      }),
    ).toBe("http://localhost:3000");
    expect(resolveAuthBaseURL({ APP_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });
});
