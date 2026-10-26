import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";

import { AppFrame, AppFrameFallback } from "@/components/app-frame/app-frame";
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
      <body className="flex min-h-full flex-col bg-(--surface) font-sans text-(--ink)">
        <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={defaultMessages}>
          {/* App frame of the redesign (R3.3, ADR 0018): NavBar from 768 px, TabBar below it */}
          <Suspense fallback={<AppFrameFallback />}>
            <AppFrame />
          </Suspense>
          {/* Room for the fixed TabBar on phones (design system TabBar rule) */}
          <div className="flex flex-1 flex-col pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
