import { describe, expect, it } from "vitest";

import { loginErrorKey } from "./login-error";

describe("loginErrorKey", () => {
  it("has no message without an error", () => {
    expect(loginErrorKey(undefined)).toBeNull();
    expect(loginErrorKey("")).toBeNull();
  });

  it("explains a Sportnet account without e-mail (ADR 0025)", () => {
    expect(loginErrorKey("email_not_found")).toBe("sportnetNoEmail");
  });

  it("shows the generic message for any other OAuth error", () => {
    expect(loginErrorKey("invalid_code")).toBe("error");
    expect(loginErrorKey(["state_not_found"])).toBe("error");
  });
});
