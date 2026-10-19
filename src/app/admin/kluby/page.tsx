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

import { SnapshotForm } from "./snapshot-form";

export const metadata: Metadata = { title: defaultMessages.admin.title };

async function AdminClubs() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("admin");
  if (!isAdmin(user)) {
    const tClub = await getTranslations("club");
    return <p className="text-sm">{tClub("forbidden")}</p>;
  }
  const clubs = await listMyClubs(clubDeps, user);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("clubs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {clubs.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {clubs.map((club) => (
                <li key={club.clubId}>
                  <Link
                    href={`/admin/kluby/${encodeURIComponent(club.clubId)}`}
                    className="hover:bg-muted/50 flex flex-col gap-0.5 px-3 py-2.5"
                  >
                    <span className="font-medium break-words">{club.name}</span>
                    <span className="text-muted-foreground text-xs break-all">
                      {club.union} · {club.clubId}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noClubs")}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("snapshot.title")}</CardTitle>
          <CardDescription>{t("snapshot.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SnapshotForm />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminClubsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AdminClubs />
      </Suspense>
    </main>
  );
}
