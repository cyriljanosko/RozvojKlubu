import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { SiteHeader } from "@/components/site-header";
import { DEFAULT_LOCALE, defaultMessages } from "@/i18n/config";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: defaultMessages.meta.siteTitle,
    template: defaultMessages.meta.titleTemplate,
  },
  description: defaultMessages.meta.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={DEFAULT_LOCALE} className="h-full scroll-pt-16 antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={defaultMessages}>
          <SiteHeader />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
