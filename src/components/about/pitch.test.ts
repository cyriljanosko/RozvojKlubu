import { describe, expect, it } from "vitest";

import { PITCH_TALL, PITCH_WIDE, project, toPolygon } from "./pitch";

describe("pitch in perspective", () => {
  it("maps the flat corners onto the trapezoid", () => {
    for (const g of [PITCH_WIDE, PITCH_TALL]) {
      expect(project(g, 0, 0)).toEqual([g.farLeft, g.top]);
      expect(project(g, 100, 0)).toEqual([g.farRight, g.top]);
      expect(project(g, 0, 100)).toEqual([g.nearLeft, g.bottom]);
      expect(project(g, 100, 100)).toEqual([g.nearRight, g.bottom]);
      expect(project(g, 50, 50)[0]).toBe(g.width / 2);
    }
    expect(
      toPolygon(PITCH_WIDE, [
        [0, 0],
        [100, 0],
      ]),
    ).toBe("170,50 510,50");
  });
});
