import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Sportnet OIDC provider (auth.sportnet.online) for Better Auth genericOAuth.
 *
 * Verified in Sportnet docs (project auth-sportnet-online):
 * - Authorization Code + PKCE (S256), `openid` scope issues an ID token
 * - endpoints /authorize and /token, JWKS at /.well-known/jwks.json
 * - RS256 tokens, iss = https://auth.sportnet.online, aud = client_id, sub = userId
 * NOT verified yet: exact ID-token profile claim names (name/surname/email) –
 * mapping below is defensive; confirm after the OAuth client is registered.
 */
export const SPORTNET_PROVIDER_ID = "sportnet";

export interface SportnetConfig {
  authUrl: string;
  clientId: string;
  clientSecret: string;
}

type Claims = JWTPayload & Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Maps Sportnet ID-token claims to the generic OAuth user info shape. */
export function mapSportnetClaims(claims: Claims) {
  const sub = str(claims.sub);
  const email = str(claims.email)?.toLowerCase();
  if (!sub || !email) return null;
  const fullName =
    str(claims.name) && str(claims.surname)
      ? `${str(claims.name)} ${str(claims.surname)}`
      : (str(claims.dnm) ?? str(claims.displayName) ?? str(claims.name) ?? email);
  const image = str(claims.photo) ?? str(claims.picture);
  return {
    id: sub,
    sub,
    email,
    name: fullName,
    image,
    // auth.sportnet.online only issues ID tokens for authenticated accounts;
    // treat the e-mail as verified so accounts can be linked by e-mail.
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
    clientSecret: config.clientSecret,
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
