import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { isAdmin } from "@/server/services/club-access";
import { getClubOverview, listClubMembers } from "@/server/services/clubs.service";
import { currentSeason } from "@/server/services/season";

import { removeMemberAction } from "../actions";
import { MemberForm } from "./member-form";

export const metadata: Metadata = { title: defaultMessages.admin.members.title };

async function ClubMembers({ params }: PageProps<"/admin/kluby/[clubId]">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("admin");
  const tClub = await getTranslations("club");
  const tClubRoles = await getTranslations("clubRoles");
  if (!isAdmin(user)) return <p className="text-sm">{tClub("forbidden")}</p>;

  const clubId = decodeURIComponent((await params).clubId);
  const season = currentSeason();
  let overview;
  try {
    overview = await getClubOverview(clubDeps, user, clubId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return <p className="text-sm">{tClub("notFound")}</p>;
    }
    throw error;
  }
  const members = await listClubMembers(clubDeps, user, clubId, season);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl break-words">{overview.club.name}</CardTitle>
          <CardDescription>
            {t("members.title")} · {t("members.season", { season })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium break-all">{m.email ?? m.userId}</span>
                    <span className="text-muted-foreground text-xs">
                      {[tClubRoles(m.role), ...m.ageGroups].join(" · ")}
                    </span>
                  </span>
                  <form action={removeMemberAction.bind(null, clubId, m.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      {t("members.remove")}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("members.empty")}</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <MemberForm clubId={clubId} />
        </CardContent>
      </Card>
      <Link href="/admin/kluby" className="text-sm font-medium underline underline-offset-4">
        {t("back")}
      </Link>
    </div>
  );
}

export default function ClubMembersPage(props: PageProps<"/admin/kluby/[clubId]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ClubMembers {...props} />
      </Suspense>
    </main>
  );
}
