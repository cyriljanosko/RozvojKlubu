import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PublicPlan } from "@/components/vizitka/public-plan";
import { VizitkaView } from "@/components/vizitka/vizitka-view";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { vizitkaDeps } from "@/server/clubs/deps";
import { seasonFromSlug, seasonToSlug } from "@/server/services/season";
import { getPublicVizitka } from "@/server/services/vizitka.service";

export const metadata: Metadata = { title: defaultMessages.vizitka.title };

type Props = PageProps<"/vizitka/[clubId]">;

/** Public Vizitka – no sign-in (ADR 0007). */
async function PublicVizitkaPage({ params, searchParams }: Props) {
  await connection();
  const clubId = decodeURIComponent((await params).clubId);
  const { season: slug } = await searchParams;
  const season = typeof slug === "string" ? seasonFromSlug(slug) : null;
  const t = await getTranslations("vizitka");
  let vizitka;
  try {
    vizitka = await getPublicVizitka(vizitkaDeps, clubId, season);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return <p className="text-sm">{t("notFound")}</p>;
    }
    throw error;
  }
  const base = `/vizitka/${encodeURIComponent(clubId)}`;
  return (
    <div className="flex flex-col gap-6">
      <VizitkaView vizitka={vizitka} seasonHref={(s) => `${base}?season=${seasonToSlug(s)}`} />
      <PublicPlan clubId={clubId} season={vizitka.season} />
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <PublicVizitkaPage {...props} />
      </Suspense>
    </main>
  );
}
