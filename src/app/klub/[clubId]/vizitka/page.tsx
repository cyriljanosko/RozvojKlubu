import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { VizitkaView } from "@/components/vizitka/vizitka-view";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps, vizitkaDeps } from "@/server/clubs/deps";
import { seasonFromSlug, seasonToSlug } from "@/server/services/season";
import { getClubVizitka } from "@/server/services/vizitka.service";
import {
  isoToday,
  listMentorVisits,
  summarizeVisits,
} from "@/server/services/mentor-visit.service";

export const metadata: Metadata = { title: defaultMessages.vizitka.title };

type Props = PageProps<"/klub/[clubId]/vizitka">;

/** Vizitka for club roles and admin_sfz (ADR 0007). */
async function ClubVizitkaPage({ params, searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const { season: slug } = await searchParams;
  const season = typeof slug === "string" ? seasonFromSlug(slug) : null;
  const t = await getTranslations("vizitka");
  const tClub = await getTranslations("club");
  let vizitka;
  try {
    vizitka = await getClubVizitka(vizitkaDeps, user, clubId, season);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <p className="text-sm">{error.code === "FORBIDDEN" ? tClub("forbidden") : t("notFound")}</p>
      );
    }
    throw error;
  }
  const base = `/klub/${encodeURIComponent(clubId)}/vizitka`;
  const seasonQuery = `?season=${seasonToSlug(vizitka.season)}`;
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}`}
          className="text-muted-foreground underline underline-offset-4"
        >
          {vizitka.club.name}
        </Link>
        <Link
          href={`/vizitka/${encodeURIComponent(clubId)}${seasonQuery}`}
          className="text-muted-foreground underline underline-offset-4"
        >
          {t("publicLink")}
        </Link>
      </nav>
      <VizitkaView
        vizitka={vizitka}
        club={vizitka}
        seasonHref={(s) => `${base}?season=${seasonToSlug(s)}`}
      />
      <VisitLine clubId={clubId} season={vizitka.season} />
    </div>
  );
}

/** Mentor visits of the season – only in the Vizitka for club roles, never public (MV-c). */
async function VisitLine({ clubId, season }: { clubId: string; season: string }) {
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("visits.vizitka");
  let list;
  try {
    list = await listMentorVisits(visitDeps, user, clubId);
  } catch {
    return null; // no access to visits (e.g. no role in the club this season)
  }
  const s = summarizeVisits(list.visits, season, isoToday());
  const date = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });
  return (
    <Link
      href={`/klub/${encodeURIComponent(clubId)}/navstevy`}
      className="hover:bg-muted/50 flex flex-wrap items-center gap-x-2 rounded-xl border p-3 text-sm"
    >
      <span className="font-medium">{t("title")}</span>
      <span className="text-muted-foreground">
        {s.lastDate ? t("line", { date: date(s.lastDate), open: s.open }) : t("none")}
      </span>
      {s.overdue > 0 && (
        <span className="text-destructive text-xs">· {t("overdue", { count: s.overdue })}</span>
      )}
    </Link>
  );
}

export default function Page(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ClubVizitkaPage {...props} />
      </Suspense>
    </main>
  );
}
