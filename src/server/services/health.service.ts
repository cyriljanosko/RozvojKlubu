export type DependencyStatus = "ok" | "down" | "not_configured";

export interface HealthReport {
  status: "ok" | "degraded";
  version: string;
  time: string;
  dependencies: {
    database: DependencyStatus;
  };
}

export interface HealthDeps {
  isDatabaseConfigured: () => boolean;
  pingDatabase: () => Promise<void>;
  version: string;
  now?: () => Date;
}

/**
 * Pure service: dependencies are injected so it can be unit-tested
 * and reused by REST API and the future MCP server.
 */
export async function getHealth(deps: HealthDeps): Promise<HealthReport> {
  let database: DependencyStatus = "not_configured";
  if (deps.isDatabaseConfigured()) {
    try {
      await deps.pingDatabase();
      database = "ok";
    } catch {
      database = "down";
    }
  }

  return {
    status: database === "down" ? "degraded" : "ok",
    version: deps.version,
    time: (deps.now ?? (() => new Date()))().toISOString(),
    dependencies: { database },
  };
}
