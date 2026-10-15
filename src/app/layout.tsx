import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

// Self-hosted fonts (no request to Google at build or runtime – GDPR friendly).
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: "Rozvoj klubu – Akadémia vzdelávania",
    template: "%s | Rozvoj klubu",
  },
  description:
    "Vzdelávanie a rozvoj futbalových klubov: vizitka klubu, mapa klubov, akadémia, 10 oblastí rozvoja a licencie.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sk" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
