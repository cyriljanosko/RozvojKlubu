import { describe, expect, it } from "vitest";

import { BANDS } from "@/server/services/kompas-scoring";
import { LICENSING_BANDS } from "@/server/services/licensing-rules";

import { AREA_LINE_CLASS, clampPercent, KOMPAS_BAND_TONE, LICENSING_BAND_CLASS } from "./bands";

describe("colour scales", () => {
  it("has a tone for every Kompas band", () => {
    for (const band of BANDS) expect(KOMPAS_BAND_TONE[band.key]).toBeTruthy();
  });

  it("has a style for every licensing band and for no band", () => {
    for (const band of [...LICENSING_BANDS, "none" as const]) {
      expect(LICENSING_BAND_CLASS[band]).toBeTruthy();
    }
  });

  it("uses only design-system tokens, never raw colours or programme colours", () => {
    const all = [...Object.values(LICENSING_BAND_CLASS), ...Object.values(AREA_LINE_CLASS)].join(
      " ",
    );
    expect(all).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(|--gold|--program-/i);
    expect(all).not.toMatch(/\b(bg|text|border)-(red|blue|green|amber|zinc|orange|emerald)-\d/);
  });
});

describe("clampPercent", () => {
  it("rounds and clamps to 0–100", () => {
    expect(clampPercent(42.6)).toBe(43);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(null)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});
