import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { isAdmin } from "@/server/services/club-access";
import { listMyClubs } from "@/server/services/clubs.service";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: defaultMessages.account.title };

async function Account() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("account");
  const tRoles = await getTranslations("roles");
  const tClubRoles = await getTranslations("clubRoles");
  const tHeader = await getTranslations("header");
  const clubs = await listMyClubs(clubDeps, user);
  const admin = isAdmin(user);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl break-words">{user.name}</CardTitle>
        <CardDescription className="break-all">{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">{t("role")}</dt>
            <dd className="font-medium">{tRoles(user.role)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">{t("sportnetAccount")}</dt>
            <dd className="font-medium">
              {user.sportnetId ? t("sportnetLinked") : t("sportnetNotLinked")}
            </dd>
          </div>
        </dl>
        <section className="flex flex-col gap-2" aria-labelledby="my-clubs">
          <h2 id="my-clubs" className="text-sm font-semibold">
            {admin ? t("allClubs") : t("myClubs")}
          </h2>
          {clubs.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {clubs.map((club) => (
                <li key={club.clubId}>
                  <Link
                    href={`/klub/${encodeURIComponent(club.clubId)}`}
                    className="hover:bg-muted/50 flex flex-col gap-0.5 px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium break-words">{club.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {[club.union, ...club.roles.map((r) => tClubRoles(r))].join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground rounded-md border p-3 text-sm">
              {t("noClubs")} {t("roleHint")}
            </p>
          )}
        </section>
        {admin && (
          <Link href="/admin/kluby" className="text-sm font-medium underline underline-offset-4">
            {tHeader("admin")}
          </Link>
        )}
        <SignOutButton />
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Account />
      </Suspense>
    </main>
  );
}
