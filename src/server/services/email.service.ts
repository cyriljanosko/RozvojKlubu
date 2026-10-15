import type { TransactionalMessage } from "@/server/integrations/ecomail/client";

export interface EmailDeps {
  copy: MagicLinkCopy;
  apiKey?: string;
  fromEmail?: string;
  fromName: string;
  isProduction: boolean;
  send: (apiKey: string, message: TransactionalMessage) => Promise<void>;
  log: (message: string) => void;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface MagicLinkCopy {
  subject: string;
  greeting: string;
  intro: string;
  button: string;
  validity: string;
  signature: string;
}

/** Builds the magic-link e-mail from translated copy (messages: email.magicLink). */
export function buildMagicLinkEmail(url: string, copy: MagicLinkCopy) {
  const text = [copy.greeting, "", copy.intro, url, "", copy.validity, "", copy.signature].join(
    "\n",
  );
  const safeUrl = escapeHtml(url);
  const html = `<!doctype html><html lang="sk"><body style="font-family:Arial,sans-serif;line-height:1.5;color:#171717">
<p>${escapeHtml(copy.greeting)}</p>
<p>${escapeHtml(copy.intro)}</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#171717;color:#fff;border-radius:8px;text-decoration:none">${escapeHtml(copy.button)}</a></p>
<p style="font-size:13px;color:#555">${escapeHtml(copy.validity)}</p>
<p style="font-size:13px;color:#555">${escapeHtml(copy.signature)}</p>
</body></html>`;
  return { subject: copy.subject, text, html };
}

/** Masks an e-mail for logs: jan.novak@sfz.sk → j***@sfz.sk */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

/**
 * Sends the magic-link e-mail. Without Ecomail configuration it only logs the
 * link in development and refuses in production (no silent loss of logins).
 */
export async function sendMagicLinkEmail(deps: EmailDeps, to: string, url: string): Promise<void> {
  if (!deps.apiKey || !deps.fromEmail) {
    if (deps.isProduction) {
      throw new Error("E-mail delivery is not configured (ECOMAIL_API_KEY, EMAIL_FROM)");
    }
    deps.log(`[email:dev] magic link for ${maskEmail(to)}: ${url}`);
    return;
  }
  const { subject, text, html } = buildMagicLinkEmail(url, deps.copy);
  await deps.send(deps.apiKey, {
    subject,
    text,
    html,
    fromEmail: deps.fromEmail,
    fromName: deps.fromName,
    to: [{ email: to }],
  });
}
