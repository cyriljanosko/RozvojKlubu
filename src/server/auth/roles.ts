/**
 * Global application roles, stored on the Better Auth `user` record as `role`.
 * Only platform-wide permissions live here; roles in a club are club memberships (ADR 0004).
 * Pure module – safe to import from client and server code.
 */
export const ROLES = ["admin_sfz", "public"] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "public";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Normalizes an unknown stored value to a valid role (unknown → public). */
export function toRole(value: unknown): Role {
  return isRole(value) ? value : DEFAULT_ROLE;
}

export function hasAnyRole(role: unknown, allowed: readonly Role[]): boolean {
  return allowed.includes(toRole(role));
}

/** Parses INITIAL_ADMIN_EMAILS ("a@x.sk, b@y.sk") into a normalized set. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Role to grant on sign-in for bootstrap admins (INITIAL_ADMIN_EMAILS), or null when nothing changes.
 * Only promotes – never demotes – so removing an e-mail from the list keeps existing admins.
 */
export function bootstrapRole(
  email: string,
  currentRole: unknown,
  adminEmails: ReadonlySet<string>,
): Role | null {
  if (toRole(currentRole) === "admin_sfz") return null;
  return adminEmails.has(email.trim().toLowerCase()) ? "admin_sfz" : null;
}
