import { describe, expect, it, vi } from "vitest";

import {
  buildMagicLinkEmail,
  maskEmail,
  sendMagicLinkEmail,
  type EmailDeps,
} from "./email.service";

const baseDeps = (over: Partial<EmailDeps> = {}): EmailDeps => ({
  fromName: "Rozvoj klubu SFZ",
  isProduction: false,
  send: vi.fn(async () => {}),
  log: vi.fn(),
  ...over,
});

describe("buildMagicLinkEmail", () => {
  it("contains the link in text and escaped in html", () => {
    const mail = buildMagicLinkEmail('https://x.sk/a?b=1&c="2"');
    expect(mail.text).toContain('https://x.sk/a?b=1&c="2"');
    expect(mail.html).toContain("&#38;c=&#34;2&#34;");
    expect(mail.subject).toMatch(/Prihlásenie/);
  });
});

describe("maskEmail", () => {
  it("masks the local part", () => {
    expect(maskEmail("jan.novak@sfz.sk")).toBe("j***@sfz.sk");
  });
});

describe("sendMagicLinkEmail", () => {
  it("logs the link in development without Ecomail config", async () => {
    const deps = baseDeps();
    await sendMagicLinkEmail(deps, "jan@sfz.sk", "https://x/link");
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("j***@sfz.sk"));
  });

  it("refuses in production without Ecomail config", async () => {
    await expect(
      sendMagicLinkEmail(baseDeps({ isProduction: true }), "jan@sfz.sk", "https://x/link"),
    ).rejects.toThrow(/not configured/);
  });

  it("sends via Ecomail when configured", async () => {
    const deps = baseDeps({ apiKey: "k", fromEmail: "noreply@ltk.solutions" });
    await sendMagicLinkEmail(deps, "jan@sfz.sk", "https://x/link");
    expect(deps.send).toHaveBeenCalledWith(
      "k",
      expect.objectContaining({
        fromEmail: "noreply@ltk.solutions",
        to: [{ email: "jan@sfz.sk" }],
      }),
    );
  });
});
