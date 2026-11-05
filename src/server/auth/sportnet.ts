import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Sportnet OIDC provider (auth.sportnet.online) for Better Auth genericOAuth.
 *
 * Confirmed by the sportnet.online developers on 2026-11-04
 * (docs/sportnet/odpovede-sportnet-online.md, A1–A8):
 * - client `rozvojklubu` is a public client: Authorization Code + PKCE (S256), no client secret
 * - endpoints /authorize and /token, JWKS at /.well-known/jwks.json; no OIDC discovery, no userinfo
 * - RS256 ID token, iss = https://auth.sportnet.online, aud = client_id, sub = Sportnet user id
 * - ID-token profile claims: name, surname, family_name, username (string or array), email
 *   (NOT guaranteed – ISSF accounts may have none), photoUrl, photoIsPublic; no nonce, picture
 *   or dnm (dnm is only in the access token)
 */
export const SPORTNET_PROVIDER_ID = "sportnet";

export interface SportnetConfig {
  authUrl: string;
  clientId: string;
}

/** Sportnet sign-in is shown as soon as the public client id is set (no secret exists). */
export function isSportnetConfigured(env: { SPORTNET_OAUTH_CLIENT_ID?: string }): boolean {
  return Boolean(env.SPORTNET_OAUTH_CLIENT_ID);
}

type Claims = JWTPayload & Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Maps Sportnet ID-token claims to the generic OAuth user info shape. */
export function mapSportnetClaims(claims: Claims) {
  const sub = str(claims.sub);
  if (!sub) return null;
  // Without e-mail the user is still returned: Better Auth then rejects the sign-in with
  // `email_not_found` and the sign-in page asks the user to add an e-mail in Sportnet (ADR 0025).
  const email = str(claims.email)?.toLowerCase();
  const first = str(claims.name);
  const last = str(claims.surname) ?? str(claims.family_name);
  const username = str(Array.isArray(claims.username) ? claims.username[0] : claims.username);
  const fullName = [first, last].filter(Boolean).join(" ") || username || email || sub;
  const image = claims.photoIsPublic === true ? str(claims.photoUrl) : undefined;
  return {
    id: sub,
    sub,
    email,
    name: fullName,
    image,
    // auth.sportnet.online only issues ID tokens for authenticated accounts;
    // treat the e-mail as verified so accounts can be linked by e-mail (ADR 0002).
    emailVerified: true,
    sportnetId: sub,
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export function sportnetProvider(config: SportnetConfig) {
  const base = config.authUrl.replace(/\/$/, "");
  return {
    providerId: SPORTNET_PROVIDER_ID,
    clientId: config.clientId,
    // Public client: only client_id goes into the token request, PKCE protects the code.
    tokenEndpointAuth: { method: "none" as const },
    authorizationUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
    scopes: ["openid"],
    pkce: true,
    async getUserInfo(tokens: { idToken?: string }) {
      if (!tokens.idToken) return null;
      jwks ??= createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
      const { payload } = await jwtVerify(tokens.idToken, jwks, {
        issuer: base,
        audience: config.clientId,
        algorithms: ["RS256"],
      });
      return mapSportnetClaims(payload as Claims);
    },
  };
}
