import { describe, expect, it } from "vitest";

import { getHealth } from "./health.service";

const now = () => new Date("2026-10-12T12:00:00.000Z");

describe("getHealth", () => {
  it("reports not_configured when there is no database", async () => {
    const report = await getHealth({
      isDatabaseConfigured: () => false,
      pingDatabase: async () => {
        throw new Error("should not be called");
      },
      version: "test",
      now,
    });
    expect(report).toEqual({
      status: "ok",
      version: "test",
      time: "2026-10-12T12:00:00.000Z",
      dependencies: { database: "not_configured" },
    });
  });

  it("reports ok when the database responds", async () => {
    const report = await getHealth({
      isDatabaseConfigured: () => true,
      pingDatabase: async () => {},
      version: "test",
      now,
    });
    expect(report.status).toBe("ok");
    expect(report.dependencies.database).toBe("ok");
  });

  it("reports degraded when the database is down", async () => {
    const report = await getHealth({
      isDatabaseConfigured: () => true,
      pingDatabase: async () => {
        throw new Error("timeout");
      },
      version: "test",
      now,
    });
    expect(report.status).toBe("degraded");
    expect(report.dependencies.database).toBe("down");
  });
});
