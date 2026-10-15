import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { getCurrentUser } from "@/server/auth/session";

async function AccountLink() {
  const user = isDatabaseConfigured() ? await getCurrentUser(await headers()) : null;
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/prihlasenie">Prihlásiť sa</Link>
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant="ghost" className="max-w-[60vw]">
      <Link href="/ucet" aria-label="Môj účet">
        <UserRound aria-hidden />
        <span className="truncate">{user.name}</span>
      </Link>
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="truncate font-semibold">
          Rozvoj klubu
        </Link>
        <Suspense fallback={<div className="h-8 w-24" aria-hidden />}>
          <AccountLink />
        </Suspense>
      </div>
    </header>
  );
}
