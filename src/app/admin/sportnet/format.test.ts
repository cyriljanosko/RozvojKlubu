import { describe, expect, it } from "vitest";

import { durationParts } from "./format";

describe("durationParts", () => {
  it("splits minutes and seconds, rounding to whole seconds", () => {
    expect(durationParts(118_400)).toEqual({ minutes: 1, seconds: 58 });
    expect(durationParts(42_600)).toEqual({ minutes: 0, seconds: 43 });
  });

  it("never goes below zero", () => {
    expect(durationParts(-5)).toEqual({ minutes: 0, seconds: 0 });
  });
});
