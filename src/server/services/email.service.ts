import type { TransactionalMessage } from "@/server/integrations/ecomail/client";

export interface EmailDeps {
  apiKey?: string;
  fromEmail?: string;
  fromName: string;
  isProduction: boolean;
  send: (apiKey: string, message: TransactionalMessage) => Promise<void>;
  log: (message: string) => void;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildMagicLinkEmail(url: string) {
  const subject = "Prihlásenie do aplikácie Rozvoj klubu";
  const text = [
    "Dobrý deň,",
    "",
    "na prihlásenie do aplikácie Rozvoj klubu otvorte tento odkaz:",
    url,
    "",
    "Odkaz platí 15 minút a dá sa použiť iba raz.",
    "Ak ste o prihlásenie nežiadali, tento e-mail môžete ignorovať.",
    "",
    "Slovenský futbalový zväz",
  ].join("\n");
  const safeUrl = escapeHtml(url);
  const html = `<!doctype html><html lang="sk"><body style="font-family:Arial,sans-serif;line-height:1.5;color:#171717">
<p>Dobrý deň,</p>
<p>na prihlásenie do aplikácie <strong>Rozvoj klubu</strong> kliknite na tlačidlo:</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#171717;color:#fff;border-radius:8px;text-decoration:none">Prihlásiť sa</a></p>
<p style="font-size:13px;color:#555">Odkaz platí 15 minút a dá sa použiť iba raz. Ak ste o prihlásenie nežiadali, tento e-mail môžete ignorovať.</p>
<p style="font-size:13px;color:#555">Slovenský futbalový zväz</p>
</body></html>`;
  return { subject, text, html };
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
  const { subject, text, html } = buildMagicLinkEmail(url);
  await deps.send(deps.apiKey, {
    subject,
    text,
    html,
    fromEmail: deps.fromEmail,
    fromName: deps.fromName,
    to: [{ email: to }],
  });
}
