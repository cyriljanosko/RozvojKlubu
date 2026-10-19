import { beforeEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();
const constructed: unknown[] = [];

vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor(uri: string) {
      constructed.push(uri);
    }
    connect = connect;
    db = (name: string) => ({ databaseName: name });
  },
}));

describe("getMongoClient", () => {
  beforeEach(() => {
    vi.resetModules();
    constructed.length = 0;
    connect.mockReset();
    delete (globalThis as { _mongoClient?: unknown })._mongoClient;
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    process.env.MONGODB_DB = "test_db";
  });

  // Bug 2026-10-15: a cached rejected connect() promise made every later request fail
  // until a cold start. The client must not connect eagerly or cache a failed attempt.
  it("does not connect eagerly and reuses one client", async () => {
    const { getMongoClient, getDbSync } = await import("./mongo");
    const a = getMongoClient();
    const b = getMongoClient();
    expect(a).toBe(b);
    expect(constructed).toHaveLength(1);
    expect(connect).not.toHaveBeenCalled();
    expect(getDbSync()).toEqual({ databaseName: "test_db" });
  });

  it("throws a clear error without MONGODB_URI", async () => {
    delete process.env.MONGODB_URI;
    const { getMongoClient } = await import("./mongo");
    expect(() => getMongoClient()).toThrow(/MONGODB_URI/);
  });
});
