import { describe, expect, it } from "vitest";

import { defaultMessages, withFallback } from "./config";

describe("withFallback", () => {
  it("keeps Slovak for keys missing in the override", () => {
    const merged = withFallback({ a: { b: "sk-b", c: "sk-c" } }, { a: { b: "cs-b" } });
    expect(merged).toEqual({ a: { b: "cs-b", c: "sk-c" } });
  });

  it("returns base when there is no override", () => {
    expect(withFallback({ a: "x" }, undefined)).toEqual({ a: "x" });
  });
});

describe("Slovak messages", () => {
  it("define a label for every role", () => {
    expect(Object.keys(defaultMessages.roles).sort()).toEqual(
      ["admin_sfz", "club_manager", "mentor", "obfz", "public", "volunteer"].sort(),
    );
  });
});
