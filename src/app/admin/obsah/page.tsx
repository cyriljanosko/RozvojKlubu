import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { isAdmin } from "@/server/services/club-access";
import { listAreas, listQuestions } from "@/server/services/content.service";

import { SeedButton } from "./seed-button";

export const metadata: Metadata = { title: defaultMessages.admin.content.title };

async function ContentOverview() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("admin.content");
  if (!isAdmin(user)) {
    const tClub = await getTranslations("club");
    return <p className="text-sm">{tClub("forbidden")}</p>;
  }
  const [areas, questions] = await Promise.all([
    listAreas(mongoContentStore, user),
    listQuestions(mongoContentStore, user),
  ]);
  const count = (n: number) => questions.filter((q) => q.area === n).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("areas")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {areas.length > 0 ? (
          <ul className="divide-y rounded-md border text-sm">
            {areas.map((area) => (
              <li key={area.number}>
                <Link
                  href={`/admin/obsah/${area.number}`}
                  className="hover:bg-muted/50 flex items-baseline gap-3 px-3 py-2.5"
                >
                  <span className="text-muted-foreground w-5 shrink-0 text-right tabular-nums">
                    {area.number}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium break-words">{area.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {t("questionsCount", { count: count(area.number) })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        )}
        <Link href="/admin/obsah/roly" className="text-sm font-medium underline underline-offset-4">
          {t("roles.open")}
        </Link>
        <SeedButton />
      </CardContent>
    </Card>
  );
}

export default function ContentPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ContentOverview />
      </Suspense>
    </main>
  );
}
