import { describe, expect, it } from "vitest";

import { OBFZ, RFZ, countByArea, mapAreas, placeOf } from "./slovakia-map";

describe("Slovakia map", () => {
  it("covers every district once and keeps ObFZ inside their RFZ", () => {
    const districts = OBFZ.flatMap((o) => o.okresy);
    expect(districts).toHaveLength(79);
    expect(new Set(districts).size).toBe(79);
    expect(mapAreas("obfz").every((a) => a.paths.length > 0)).toBe(true);
    expect(mapAreas("rfz").map((a) => [a.id, a.paths.length])).toEqual([
      ["BFZ", 1],
      ["ZsFZ", 3],
      ["SsFZ", 2],
      ["VsFZ", 2],
    ]);
    expect(RFZ).toHaveLength(4);
  });

  it("places the pilot clubs and counts them per area", () => {
    expect(placeOf("fk-v-niznom-zipove.futbalnet.sk")).toEqual({
      district: "Trebišov",
      obfz: "ObFZ Trebišov",
      rfz: "VsFZ",
    });
    expect(placeOf("tj-slovan-bojna.futbalnet.sk")).toMatchObject({
      obfz: "ObFZ Topoľčany",
      rfz: "ZsFZ",
    });
    expect(placeOf("neznamy-klub")).toBeNull();
    const places = [
      "fk-v-niznom-zipove.futbalnet.sk",
      "slavoj-trebisov.futbalnet.sk",
      "fam-poprad.futbalnet.sk",
      "x",
    ].map(placeOf);
    expect(Object.fromEntries(countByArea(places, "rfz"))).toEqual({ VsFZ: 3 });
    expect(Object.fromEntries(countByArea(places, "obfz"))).toEqual({
      "ObFZ Trebišov": 2,
      "Podtatranský FZ": 1,
    });
  });
});
