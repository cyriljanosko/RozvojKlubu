import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PublicPlan } from "@/components/vizitka/public-plan";
import { VizitkaView } from "@/components/vizitka/vizitka-view";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { Milestones } from "@/components/vizitka/milestones";
import { rankingsDeps, vizitkaDeps } from "@/server/clubs/deps";
import { seasonFromSlug, seasonToSlug } from "@/server/services/season";
import { getPublicVizitka } from "@/server/services/vizitka.service";
import { getPublicMilestones } from "@/server/services/vizitky.service";

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
      <MilestonesBlock clubId={clubId} season={vizitka.season} />
      <PublicPlan clubId={clubId} season={vizitka.season} />
    </div>
  );
}

/** The season's milestones – only for clubs that consented to the public rankings (ADR 0015). */
async function MilestonesBlock({ clubId, season }: { clubId: string; season: string }) {
  const milestones = await getPublicMilestones(rankingsDeps, clubId, season);
  if (!milestones) return null;
  const t = await getTranslations("milestones");
  return (
    <section
      aria-labelledby="vizitka-milestones"
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <div>
        <h2 id="vizitka-milestones" className="text-lg font-semibold">
          {t("title", { season })}
        </h2>
        <p className="text-muted-foreground text-xs">
          {t("count", { count: milestones.length, total: 6 })}
        </p>
      </div>
      <Milestones reached={milestones} variant="list" />
    </section>
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
