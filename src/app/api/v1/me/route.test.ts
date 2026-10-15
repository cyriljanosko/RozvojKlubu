import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));

const { GET } = await import("./route");

const call = () => GET(new Request("http://localhost/api/v1/me"), {} as never);

describe("GET /api/v1/me", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("returns 401 when not signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("returns the signed-in user", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: "a@sfz.sk", name: "A", role: "mentor" });
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).data).toMatchObject({ id: "u1", role: "mentor" });
  });
});
