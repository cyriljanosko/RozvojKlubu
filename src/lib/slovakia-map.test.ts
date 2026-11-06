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
    expect(placeOf({ clubId: "fk-v-niznom-zipove.futbalnet.sk" })).toEqual({
      district: "Trebišov",
      obfz: "ObFZ Trebišov",
      rfz: "VsFZ",
    });
    expect(placeOf({ clubId: "tj-slovan-bojna.futbalnet.sk" })).toMatchObject({
      obfz: "ObFZ Topoľčany",
      rfz: "ZsFZ",
    });
    expect(placeOf({ clubId: "neznamy-klub" })).toBeNull();
    const places = [
      "fk-v-niznom-zipove.futbalnet.sk",
      "slavoj-trebisov.futbalnet.sk",
      "fam-poprad.futbalnet.sk",
      "x",
    ].map((clubId) => placeOf({ clubId }));
    expect(Object.fromEntries(countByArea(places, "rfz"))).toEqual({ VsFZ: 3 });
    expect(Object.fromEntries(countByArea(places, "obfz"))).toEqual({
      "ObFZ Trebišov": 2,
      "Podtatranský FZ": 1,
    });
  });

  it("every ObFZ has its own Sportnet union id", () => {
    const ids = OBFZ.map((o) => o.sportnetId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(OBFZ.length);
  });

  // S3 (ADR 0028): clubs imported from Sportnet have no district – they are placed by union.
  it("places other clubs by their registering union from Sportnet", () => {
    expect(
      placeOf({ clubId: "1-fc-caklov", unionId: "obfz-vranov-nad-toplou.futbalnet.sk" }),
    ).toEqual({
      obfz: "ObFZ Vranov nad Topľou",
      rfz: "VsFZ",
    });
    expect(placeOf({ clubId: "attack-vrutky", unionId: "TFZ" })).toEqual({
      obfz: "Turčiansky FZ Martin",
      rfz: "SsFZ",
    });
    // registered directly with the regional union: RFZ only, not counted at ObFZ level
    const kezmarok = placeOf({ clubId: "1-mfk-kezmarok", unionId: "VsFZ", regionId: "VsFZ" });
    expect(kezmarok).toEqual({ obfz: null, rfz: "VsFZ" });
    expect(Object.fromEntries(countByArea([kezmarok], "obfz"))).toEqual({});
    expect(Object.fromEntries(countByArea([kezmarok], "rfz"))).toEqual({ VsFZ: 1 });
    // SFZ, ÚLK or futsal: no place
    expect(placeOf({ clubId: "dukla", unionId: "ulk.futbalnet.sk" })).toBeNull();
    expect(placeOf({ clubId: "as-trencin", unionId: "futbalsfz.sk" })).toBeNull();
    // the pilot district wins over the union
    expect(placeOf({ clubId: "fam-poprad.futbalnet.sk", unionId: "VsFZ" })).toMatchObject({
      district: "Poprad",
      obfz: "Podtatranský FZ",
    });
  });
});
