import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

// The provider fetches Sportnet's JWKS; tests serve a local key set instead.
const keys = vi.hoisted(() => ({ jwks: { keys: [] as JWK[] } }));
vi.mock("jose", async (importOriginal) => {
  const jose = await importOriginal<typeof import("jose")>();
  return { ...jose, createRemoteJWKSet: () => jose.createLocalJWKSet(keys.jwks) };
});

import {
  isSportnetConfigured,
  mapSportnetClaims,
  sportnetIdFromAccount,
  sportnetProvider,
} from "./sportnet";

describe("mapSportnetClaims", () => {
  it("maps sub, e-mail and full name from name + surname", () => {
    expect(
      mapSportnetClaims({ sub: "5aa7", email: "Jan@SFZ.sk", name: "Ján", surname: "Novák" }),
    ).toMatchObject({ id: "5aa7", sportnetId: "5aa7", email: "jan@sfz.sk", name: "Ján Novák" });
  });

  it("falls back to family_name, single name part, username and e-mail", () => {
    expect(
      mapSportnetClaims({ sub: "1", email: "a@b.sk", name: "Ján", family_name: "Novák" })?.name,
    ).toBe("Ján Novák");
    expect(mapSportnetClaims({ sub: "1", email: "a@b.sk", surname: "Novák" })?.name).toBe("Novák");
    expect(mapSportnetClaims({ sub: "1", email: "a@b.sk", username: ["jnovak", "x"] })?.name).toBe(
      "jnovak",
    );
    expect(mapSportnetClaims({ sub: "1", email: "a@b.sk" })?.name).toBe("a@b.sk");
  });

  it("ignores claims that the Sportnet ID token does not carry (dnm, displayName, picture)", () => {
    const user = mapSportnetClaims({
      sub: "1",
      email: "a@b.sk",
      dnm: "Klub X",
      displayName: "Y",
      picture: "https://x/p.png",
    });
    expect(user?.name).toBe("a@b.sk");
    expect(user?.image).toBeUndefined();
  });

  it("uses photoUrl only when the photo is public", () => {
    const claims = { sub: "1", email: "a@b.sk", photoUrl: "https://media.sportnet.online/p.jpg" };
    expect(mapSportnetClaims({ ...claims, photoIsPublic: true })?.image).toBe(claims.photoUrl);
    expect(mapSportnetClaims({ ...claims, photoIsPublic: false })?.image).toBeUndefined();
    expect(mapSportnetClaims(claims)?.image).toBeUndefined();
  });

  // ADR 0025: ISSF accounts may come without e-mail. The user info is still returned (without
  // e-mail), so Better Auth rejects the sign-in with `email_not_found` and the sign-in page can
  // tell the user what to do – instead of a generic `unable_to_get_user_info`.
  it("returns the user without e-mail when the claim is missing", () => {
    const user = mapSportnetClaims({ sub: "1", name: "Ján", surname: "Novák" });
    expect(user).not.toBeNull();
    expect(user?.email).toBeUndefined();
    expect(user?.sportnetId).toBe("1");
  });

  it("rejects tokens without sub", () => {
    expect(mapSportnetClaims({ email: "a@b.sk" })).toBeNull();
  });
});

describe("sportnetProvider", () => {
  const p = sportnetProvider({ authUrl: "https://auth.sportnet.online/", clientId: "rozvojklubu" });

  it("uses documented endpoints with PKCE and openid scope", () => {
    expect(p.authorizationUrl).toBe("https://auth.sportnet.online/authorize");
    expect(p.tokenUrl).toBe("https://auth.sportnet.online/token");
    expect(p.pkce).toBe(true);
    expect(p.scopes).toEqual(["openid"]);
  });

  it("is a public client: no secret, client_id sent in the token request body", () => {
    expect(p).not.toHaveProperty("clientSecret");
    expect(p.tokenEndpointAuth).toEqual({ method: "none" });
    expect(p).not.toHaveProperty("discoveryUrl");
  });
});

describe("sportnetProvider.getUserInfo", () => {
  const p = sportnetProvider({ authUrl: "https://auth.sportnet.online", clientId: "rozvojklubu" });
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    keys.jwks.keys = [{ ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" }];
  });

  const idToken = (iss: string, aud = "rozvojklubu") =>
    new SignJWT({ name: "Ján", surname: "Letko", email: "jan@example.sk" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("55a6733f03af1ade801a2231")
      .setIssuer(iss)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  // Regression (2026-11-05, first real sign-in): auth.sportnet.online issues
  // `iss: "auth.sportnet.online"` without the scheme; requiring the URL failed every sign-in with 500.
  it("accepts the issuer as auth.sportnet.online sends it (host without scheme)", async () => {
    const user = await p.getUserInfo({ idToken: await idToken("auth.sportnet.online") });
    expect(user).toMatchObject({ id: "55a6733f03af1ade801a2231", name: "Ján Letko" });
  });

  it("accepts the issuer as a full URL", async () => {
    const user = await p.getUserInfo({ idToken: await idToken("https://auth.sportnet.online") });
    expect(user?.id).toBe("55a6733f03af1ade801a2231");
  });

  it("rejects a foreign issuer or audience without throwing", async () => {
    expect(await p.getUserInfo({ idToken: await idToken("evil.example") })).toBeNull();
    expect(
      await p.getUserInfo({ idToken: await idToken("auth.sportnet.online", "other-client") }),
    ).toBeNull();
  });
});

describe("isSportnetConfigured", () => {
  // Regression: sign-in used to require SPORTNET_OAUTH_CLIENT_SECRET, which the public
  // client `rozvojklubu` does not have, so the Sportnet button never showed.
  it("needs only the client id", () => {
    expect(isSportnetConfigured({ SPORTNET_OAUTH_CLIENT_ID: "rozvojklubu" })).toBe(true);
    expect(isSportnetConfigured({})).toBe(false);
  });
});

describe("sportnetIdFromAccount", () => {
  // Regression (2026-11-05): mapProfileToUser's sportnetId was dropped by Better Auth
  // (input: false), so the account page always said "Bez prepojenia so sportnet.online".
  it("takes the Sportnet user id from a sportnet account", () => {
    expect(sportnetIdFromAccount({ providerId: "sportnet", accountId: "55a6733f" })).toBe(
      "55a6733f",
    );
  });

  it("ignores other providers and empty ids", () => {
    expect(sportnetIdFromAccount({ providerId: "magic-link", accountId: "x" })).toBeNull();
    expect(sportnetIdFromAccount({ providerId: "sportnet", accountId: "" })).toBeNull();
  });
});
