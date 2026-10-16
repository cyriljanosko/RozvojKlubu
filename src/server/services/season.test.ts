import { describe, expect, it } from "vitest";

import { currentSeason, isSeason, seasonFromSlug, seasonToSlug } from "./season";

describe("season", () => {
  it("switches season on 1 July", () => {
    expect(currentSeason(new Date("2026-06-30T12:00:00Z"))).toBe("2025/2026");
    expect(currentSeason(new Date("2026-07-01T12:00:00Z"))).toBe("2026/2027");
    expect(currentSeason(new Date("2026-10-16T12:00:00Z"))).toBe("2026/2027");
  });

  it("validates the format", () => {
    expect(isSeason("2026/2027")).toBe(true);
    expect(isSeason("2026/2028")).toBe(false);
    expect(isSeason("2026-2027")).toBe(false);
    expect(isSeason(2026)).toBe(false);
  });

  it("converts to and from URL slugs", () => {
    expect(seasonToSlug("2026/2027")).toBe("2026-2027");
    expect(seasonFromSlug("2026-2027")).toBe("2026/2027");
    expect(seasonFromSlug("abc")).toBeNull();
  });
});
