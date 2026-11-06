import { afterEach, describe, expect, it, vi } from "vitest";

const runRecordedClubSync = vi.fn(async () => ({ sportnetClubs: 1, created: 0 }));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/clubs/deps", () => ({ syncRunDeps: {} }));
vi.mock("@/server/services/sync-runs.service", () => ({ runRecordedClubSync }));

const { GET } = await import("./route");

const req = (auth?: string) =>
  new Request("http://localhost/api/v1/cron/sportnet-clubs", {
    headers: auth ? { authorization: auth } : {},
  });
const ctx = { params: Promise.resolve({}) } as never;

describe("GET /api/v1/cron/sportnet-clubs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    runRecordedClubSync.mockClear();
  });

  it("runs the sync with the Vercel cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ sportnetClubs: 1 });
    expect(runRecordedClubSync).toHaveBeenCalledWith({}, "cron");
  });

  it("refuses a wrong or missing secret, and every call when none is configured", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req("Bearer wrong"), ctx)).status).toBe(401);
    expect((await GET(req(), ctx)).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "), ctx)).status).toBe(401);
    expect(runRecordedClubSync).not.toHaveBeenCalled();
  });
});
