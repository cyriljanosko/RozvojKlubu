import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, loadMessages } from "./config";

// No locale routing yet: the whole app is Slovak.
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: await loadMessages(DEFAULT_LOCALE),
  timeZone: "Europe/Bratislava",
}));
