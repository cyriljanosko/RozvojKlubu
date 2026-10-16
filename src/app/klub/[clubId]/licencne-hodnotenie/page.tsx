import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { licensingDeps } from "@/server/clubs/deps";
import { getClubOverview } from "@/server/services/clubs.service";
import { getLicensing } from "@/server/services/licensing.service";
import { seasonFromSlug, seasonToSlug } from "@/server/services/season";

import { LicensingForm } from "./licensing-form";
import { ReopenSeason } from "./reopen-season";

export const metadata: Metadata = { title: defaultMessages.licensing.title };

type Props = PageProps<"/klub/[clubId]/licencne-hodnotenie">;

async function Licensing({ params, searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const { season: slug } = await searchParams;
  const requested = typeof slug === "string" ? seasonFromSlug(slug) : null;
  const t = await getTranslations("licensing");
  const tClub = await getTranslations("club");

  let view;
  try {
    view = await getLicensing(licensingDeps, user, clubId, requested);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <p className="text-sm">{error.code === "FORBIDDEN" ? tClub("forbidden") : t("notFound")}</p>
      );
    }
    throw error;
  }
  const club = await getClubOverview(licensingDeps, user, clubId);
  const base = `/klub/${encodeURIComponent(clubId)}/licencne-hodnotenie`;
  const date = (d: Date | string) =>
    new Date(d).toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {club.club.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <nav aria-label={t("season")} className="flex flex-wrap gap-2 text-sm">
          {view.seasons.map((s) => (
            <Link
              key={s}
              href={`${base}?season=${seasonToSlug(s)}`}
              aria-current={s === view.season ? "page" : undefined}
              className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground rounded-md border px-3 py-1.5"
            >
              {s}
            </Link>
          ))}
        </nav>
        <p className="text-muted-foreground text-sm">
          {view.dataAsOf && t("dataAsOf", { date: date(view.dataAsOf) })} · {t("rules")}
        </p>
        {view.closed ? (
          <div className="bg-muted flex flex-col gap-2 rounded-md p-3 text-sm">
            <p>{t("closed", { date: date(view.closed.closedAt) })}</p>
            {view.canReopen && <ReopenSeason clubId={clubId} season={view.season} />}
          </div>
        ) : (
          <p className="text-sm">{view.access === "edit" ? t("intro") : t("readOnly")}</p>
        )}
      </header>
      <LicensingForm
        key={`${view.season}-${view.closed?.id ?? "open"}`}
        clubId={clubId}
        season={view.season}
        editable={view.access === "edit" && !view.closed}
        version={view.version}
        inputs={view.inputs}
        result={view.result}
        sportnet={view.sportnet}
      />
    </div>
  );
}

export default function LicensingPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Licensing {...props} />
      </Suspense>
    </main>
  );
}
