import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/mongo", () => ({ getDb: vi.fn() }));
vi.mock("@/server/db/clubs.store", () => ({ mongoClubStore: {} }));

const { adminClubsMongoFilter } = await import("./admin-clubs.store");

describe("adminClubsMongoFilter", () => {
  it("returns an empty filter without criteria and one condition as is", () => {
    expect(adminClubsMongoFilter({})).toEqual({});
    expect(adminClubsMongoFilter({ status: "active" })).toEqual({ status: "active" });
  });

  it("combines every criterion; no region also matches a missing field", () => {
    expect(
      adminClubsMongoFilter({
        status: "excluded",
        region: "none",
        unionId: "obfz-trnava",
        namePattern: "kl[uúů]b",
        clubIds: { nin: ["a"] },
      }),
    ).toEqual({
      $and: [
        { status: "excluded" },
        { region: { $in: ["", null] } },
        { unionId: "obfz-trnava" },
        { name: { $regex: "kl[uúů]b", $options: "i" } },
        { clubId: { $nin: ["a"] } },
      ],
    });
  });

  it("matches the IČO from its start, digits only", () => {
    expect(adminClubsMongoFilter({ businessIdPrefix: "1706" })).toEqual({
      businessId: { $regex: "^1706" },
    });
    expect(adminClubsMongoFilter({ region: "BFZ", clubIds: { in: [] } })).toEqual({
      $and: [{ region: "BFZ" }, { clubId: { $in: [] } }],
    });
  });
});
