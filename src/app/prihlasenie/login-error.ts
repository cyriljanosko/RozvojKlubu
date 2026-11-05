/** Message key (namespace `login`) for the `?error=` code Better Auth puts on the sign-in page. */
export type LoginErrorKey = "sportnetNoEmail" | "error";

export function loginErrorKey(error: string | string[] | undefined): LoginErrorKey | null {
  const code = Array.isArray(error) ? error[0] : error;
  if (!code) return null;
  // Sportnet account without e-mail (ISSF accounts) – ADR 0025.
  if (code === "email_not_found") return "sportnetNoEmail";
  return "error";
}
