import { describe, expect, it, vi } from "vitest";

import { changeUserRole, requireRole, type CurrentUser, type UserStore } from "./users.service";

const user = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  id: "u1",
  email: "a@sfz.sk",
  name: "A",
  role: "public",
  ...over,
});

const store = (existing: CurrentUser | null = user({ id: "u2" })): UserStore => ({
  findById: vi.fn(async () => existing),
  updateRole: vi.fn(async (id, role) => user({ id, role })),
});

describe("requireRole", () => {
  it("rejects anonymous with 401 and wrong role with 403", () => {
    expect(() => requireRole(null, ["admin_sfz"])).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    expect(() => requireRole(user(), ["admin_sfz"])).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});

describe("changeUserRole", () => {
  const admin = user({ id: "admin", role: "admin_sfz" });

  it("lets admin_sfz change another user's role", async () => {
    const s = store();
    const result = await changeUserRole(s, admin, "u2", "mentor");
    expect(result.role).toBe("mentor");
    expect(s.updateRole).toHaveBeenCalledWith("u2", "mentor");
  });

  it("forbids non-admins", async () => {
    await expect(changeUserRole(store(), user({ role: "obfz" }), "u2", "mentor")).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("rejects unknown roles", async () => {
    await expect(changeUserRole(store(), admin, "u2", "superuser")).rejects.toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("prevents an admin from demoting themselves", async () => {
    await expect(changeUserRole(store(), admin, "admin", "public")).rejects.toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });

  it("returns 404 for a missing user", async () => {
    await expect(changeUserRole(store(null), admin, "nope", "mentor")).rejects.toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});
