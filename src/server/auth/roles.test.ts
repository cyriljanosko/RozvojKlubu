import { describe, expect, it } from "vitest";

import { bootstrapRole, hasAnyRole, isRole, parseAdminEmails, ROLES, toRole } from "./roles";

describe("roles", () => {
  it("has only global roles (club roles are memberships, ADR 0004)", () => {
    expect(ROLES).toEqual(["admin_sfz", "public"]);
  });

  it("normalizes unknown values to public", () => {
    expect(toRole("hacker")).toBe("public");
    expect(toRole(undefined)).toBe("public");
    expect(toRole("admin_sfz")).toBe("admin_sfz");
    expect(toRole("club_manager")).toBe("public"); // removed role → public
    expect(isRole("obfz")).toBe(false);
  });

  it("checks allowed roles", () => {
    expect(hasAnyRole("admin_sfz", ["admin_sfz"])).toBe(true);
    expect(hasAnyRole("public", ["admin_sfz"])).toBe(false);
  });

  it("parses admin e-mails case-insensitively", () => {
    expect(parseAdminEmails(" A@SFZ.sk, b@x.sk ,,")).toEqual(new Set(["a@sfz.sk", "b@x.sk"]));
    expect(parseAdminEmails(undefined).size).toBe(0);
  });

  // Bug 2026-10-16: INITIAL_ADMIN_EMAILS only applied when the account was created, so a person
  // who signed in before being listed (shared DB for local and production) never became admin.
  it("promotes listed e-mails on sign-in, never demotes", () => {
    const admins = parseAdminEmails("cyril@sfz.sk");
    expect(bootstrapRole("Cyril@SFZ.sk", "public", admins)).toBe("admin_sfz");
    expect(bootstrapRole("cyril@sfz.sk", "admin_sfz", admins)).toBeNull();
    expect(bootstrapRole("other@sfz.sk", "public", admins)).toBeNull();
    expect(bootstrapRole("other@sfz.sk", "admin_sfz", admins)).toBeNull();
  });
});
