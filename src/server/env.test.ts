import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

describe("parseEnv", () => {
  // Bug 2026-10-15: `.env.local` with empty keys (e.g. `SPORTNET_API_URL=`) failed URL validation.
  it("treats empty values as not set", () => {
    const env = parseEnv({
      MONGODB_URI: "mongodb+srv://u:p@cluster.example.net",
      SPORTNET_API_URL: "",
      SPORTNET_API_KEY: "",
      ECOMAIL_API_KEY: "",
      EMAIL_FROM: "",
    });
    expect(env.SPORTNET_API_URL).toBeUndefined();
    expect(env.SPORTNET_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
  });

  it("applies defaults", () => {
    const env = parseEnv({});
    expect(env.MONGODB_DB).toBe("rozvojklubu");
    expect(env.SPORTNET_AUTH_URL).toBe("https://auth.sportnet.online");
  });

  it("rejects a too short auth secret", () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
