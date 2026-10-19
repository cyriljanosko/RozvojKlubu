import "server-only";

/**
 * Minimal Ecomail transactional API client.
 * Docs: https://docs.ecomail.cz/api-reference/transactional/send-message
 * Requires a verified sender domain in the Ecomail account.
 */
const ECOMAIL_API = "https://api2.ecomailapp.cz";

export interface TransactionalMessage {
  subject: string;
  fromName: string;
  fromEmail: string;
  to: { email: string; name?: string }[];
  html: string;
  text: string;
}

export async function sendTransactional(
  apiKey: string,
  message: TransactionalMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`${ECOMAIL_API}/transactional/send-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", key: apiKey },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        from_name: message.fromName,
        from_email: message.fromEmail,
        to: message.to,
        html: message.html,
        text: message.text,
      },
    }),
  });

  if (!response.ok) {
    // Never include the API key or recipient in the error message.
    throw new Error(`Ecomail responded with HTTP ${response.status}`);
  }
}
