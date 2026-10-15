"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. Sportnet (genericOAuth) is registered as a social
 * provider on the server, so it is started with `signIn.social({ provider: "sportnet" })`.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
