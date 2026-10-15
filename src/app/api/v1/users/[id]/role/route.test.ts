import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const store = {
  findById: vi.fn(),
  updateRole: vi.fn(),
};

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser, betterAuthUserStore: store }));

const { PATCH } = await import("./route");

const call = (body: unknown, id = "u2") =>
  PATCH(
    new Request(`http://localhost/api/v1/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never,
  );

const admin = { id: "admin", email: "x@sfz.sk", name: "Admin", role: "admin_sfz" };

describe("PATCH /api/v1/users/:id/role", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    store.findById.mockReset().mockResolvedValue({ id: "u2", role: "public" });
    store.updateRole.mockReset().mockImplementation(async (id, role) => ({ id, role }));
  });

  it("lets admin_sfz change a role", async () => {
    getCurrentUser.mockResolvedValue(admin);
    const res = await call({ role: "club_manager" });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ id: "u2", role: "club_manager" });
  });

  it("returns 401 for anonymous and 403 for other roles", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await call({ role: "mentor" })).status).toBe(401);
    getCurrentUser.mockResolvedValue({ ...admin, id: "m", role: "obfz" });
    expect((await call({ role: "mentor" })).status).toBe(403);
    expect(store.updateRole).not.toHaveBeenCalled();
  });

  it("validates the body", async () => {
    getCurrentUser.mockResolvedValue(admin);
    expect((await call({})).status).toBe(400);
    expect((await call({ role: "superuser" })).status).toBe(400);
  });
});
