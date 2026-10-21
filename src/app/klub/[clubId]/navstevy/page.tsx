import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { getClubOverview } from "@/server/services/clubs.service";
import { listMentorVisits } from "@/server/services/mentor-visit.service";

export const metadata: Metadata = { title: defaultMessages.visits.title };

type Props = PageProps<"/klub/[clubId]/navstevy">;

async function Visits({ params }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const t = await getTranslations("visits");
  const tClub = await getTranslations("club");
  const format = await getFormatter();
  let list;
  try {
    list = await listMentorVisits(visitDeps, user, clubId);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <p className="text-sm">
          {error.code === "FORBIDDEN" ? tClub("forbidden") : tClub("notFound")}
        </p>
      );
    }
    throw error;
  }
  const club = await getClubOverview(visitDeps, user, clubId);
  const base = `/klub/${encodeURIComponent(clubId)}/navstevy`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {club.club.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {list.access === "write" ? t("introMentor") : t("introClub")}
        </p>
        {list.access === "write" && (
          <Button asChild className="self-start">
            <Link href={`${base}/nova`}>
              <Plus aria-hidden /> {t("new")}
            </Link>
          </Button>
        )}
      </header>
      {list.visits.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.visits.map((v) => {
            const open = v.actions.filter((a) => !a.done).length;
            return (
              <li key={v.id}>
                <Link
                  href={`${base}/${v.id}`}
                  className="hover:bg-muted/50 flex flex-col gap-1 rounded-xl border p-4 text-sm"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {format.dateTime(new Date(`${v.date}T12:00:00Z`), { dateStyle: "long" })}
                    </span>
                    <span className="text-muted-foreground">· {t(`form.forms.${v.form}`)}</span>
                    <span className="rounded-full border px-2 py-0.5 text-xs">
                      {t(`status.${v.status}`)}
                    </span>
                  </span>
                  {v.summary && (
                    <span className="text-muted-foreground line-clamp-2">{v.summary}</span>
                  )}
                  <span className="text-xs">
                    {t("actionsCount", { total: v.actions.length, open })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function VisitsPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Visits {...props} />
      </Suspense>
    </main>
  );
}
