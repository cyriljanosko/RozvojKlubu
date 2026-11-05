import { describe, expect, it } from "vitest";

import { isSportnetConfigured, mapSportnetClaims, sportnetProvider } from "./sportnet";

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

describe("isSportnetConfigured", () => {
  // Regression: sign-in used to require SPORTNET_OAUTH_CLIENT_SECRET, which the public
  // client `rozvojklubu` does not have, so the Sportnet button never showed.
  it("needs only the client id", () => {
    expect(isSportnetConfigured({ SPORTNET_OAUTH_CLIENT_ID: "rozvojklubu" })).toBe(true);
    expect(isSportnetConfigured({})).toBe(false);
  });
});
