import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { getCurrentUser } from "@/server/auth/session";

async function AccountLink() {
  const t = await getTranslations("header");
  const requestHeaders = await headers();
  let user = null;
  if (isDatabaseConfigured()) {
    try {
      user = await getCurrentUser(requestHeaders);
    } catch (error) {
      // Auth misconfiguration (e.g. missing secret) must not break every page.
      console.error(`[header] cannot resolve session: ${(error as Error).message}`);
    }
  }
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/prihlasenie">{t("signIn")}</Link>
      </Button>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button asChild size="sm" variant="ghost">
        <Link href="/moja-akademia">{t("academy")}</Link>
      </Button>
      <Button asChild size="sm" variant="ghost" className="max-w-[40vw]">
        <Link href="/ucet" aria-label={t("myAccount")}>
          <UserRound aria-hidden />
          <span className="truncate">{user.name}</span>
        </Link>
      </Button>
    </div>
  );
}

export async function SiteHeader() {
  const t = await getTranslations("header");
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="truncate font-semibold">
          {t("brand")}
        </Link>
        <Suspense fallback={<div className="h-8 w-24" aria-hidden />}>
          <AccountLink />
        </Suspense>
      </div>
    </header>
  );
}
