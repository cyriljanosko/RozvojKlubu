import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Badge, Card, EmptyState, LinkButton, LinkChip } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { licensingDeps } from "@/server/clubs/deps";
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
        <EmptyState
          title={error.code === "FORBIDDEN" ? tClub("forbidden") : t("notFound")}
          action={<LinkButton href="/moja-akademia">{tClub("back")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  const base = `/klub/${encodeURIComponent(clubId)}/licencne-hodnotenie`;
  const date = (d: Date | string) =>
    new Date(d).toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="title-1">{t("title")}</h1>
        {view.seasons.length > 1 && (
          <nav
            aria-label={t("season")}
            className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
          >
            {view.seasons.map((s) => (
              <LinkChip
                key={s}
                href={`${base}?season=${seasonToSlug(s)}`}
                selected={s === view.season}
              >
                {s}
              </LinkChip>
            ))}
          </nav>
        )}
        <Card variant="highlight">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="title-3">{t("seasonTitle", { season: view.season })}</span>
              {view.closed ? (
                <Badge tone="success" dot>
                  {t("stateClosed")}
                </Badge>
              ) : (
                <Badge tone="info" dot>
                  {t("stateOpen")}
                </Badge>
              )}
            </div>
            <p className="footnote text-(--ink-muted)">
              {view.dataAsOf && `${t("dataAsOf", { date: date(view.dataAsOf) })} · `}
              {t("rules")}
            </p>
            {view.closed ? (
              <>
                <p className="callout">{t("closed", { date: date(view.closed.closedAt) })}</p>
                {view.canReopen && <ReopenSeason clubId={clubId} season={view.season} />}
              </>
            ) : (
              <p className="callout">{view.access === "edit" ? t("intro") : t("readOnly")}</p>
            )}
          </div>
        </Card>
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Licensing {...props} />
      </Suspense>
    </main>
  );
}
