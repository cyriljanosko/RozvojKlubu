import { describe, expect, it } from "vitest";

import { mapSportnetClaims, sportnetProvider } from "./sportnet";

describe("mapSportnetClaims", () => {
  it("maps sub, e-mail and full name", () => {
    expect(
      mapSportnetClaims({ sub: "5aa7", email: "Jan@SFZ.sk", name: "Ján", surname: "Novák" }),
    ).toMatchObject({ id: "5aa7", sportnetId: "5aa7", email: "jan@sfz.sk", name: "Ján Novák" });
  });

  it("falls back to display name, then e-mail", () => {
    expect(mapSportnetClaims({ sub: "1", email: "a@b.sk", dnm: "Klub X" })?.name).toBe("Klub X");
    expect(mapSportnetClaims({ sub: "1", email: "a@b.sk" })?.name).toBe("a@b.sk");
  });

  it("rejects tokens without sub or e-mail", () => {
    expect(mapSportnetClaims({ email: "a@b.sk" })).toBeNull();
    expect(mapSportnetClaims({ sub: "1" })).toBeNull();
  });
});

describe("sportnetProvider", () => {
  it("uses documented endpoints with PKCE and openid scope", () => {
    const p = sportnetProvider({
      authUrl: "https://auth.sportnet.online/",
      clientId: "c",
      clientSecret: "s",
    });
    expect(p.authorizationUrl).toBe("https://auth.sportnet.online/authorize");
    expect(p.tokenUrl).toBe("https://auth.sportnet.online/token");
    expect(p.pkce).toBe(true);
    expect(p.scopes).toEqual(["openid"]);
  });
});
