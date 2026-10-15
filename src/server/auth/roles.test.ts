import { describe, expect, it } from "vitest";

import { hasAnyRole, isRole, parseAdminEmails, ROLES, toRole } from "./roles";

describe("roles", () => {
  it("has the six agreed roles", () => {
    expect(ROLES).toEqual(["admin_sfz", "obfz", "club_manager", "mentor", "volunteer", "public"]);
  });

  it("normalizes unknown values to public", () => {
    expect(toRole("hacker")).toBe("public");
    expect(toRole(undefined)).toBe("public");
    expect(toRole("mentor")).toBe("mentor");
    expect(isRole("obfz")).toBe(true);
  });

  it("checks allowed roles", () => {
    expect(hasAnyRole("admin_sfz", ["admin_sfz"])).toBe(true);
    expect(hasAnyRole("public", ["admin_sfz", "obfz"])).toBe(false);
  });

  it("parses admin e-mails case-insensitively", () => {
    expect(parseAdminEmails(" A@SFZ.sk, b@x.sk ,,")).toEqual(new Set(["a@sfz.sk", "b@x.sk"]));
    expect(parseAdminEmails(undefined).size).toBe(0);
  });
});
