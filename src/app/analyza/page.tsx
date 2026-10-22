import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { GroupedBars, TrendLines } from "@/components/analytics/charts";
import { KompasHeatmap } from "@/components/analytics/kompas-heatmap";
import { Button } from "@/components/ui/button";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { analyticsDeps } from "@/server/clubs/deps";
import {
  activityTotals,
  getAnalytics,
  licensingAverages,
  sportnetTrend,
  type ClubSize,
} from "@/server/services/analytics.service";
import { currentSeason } from "@/server/services/season";

export const metadata: Metadata = { title: defaultMessages.analytics.title };

type Props = PageProps<"/analyza">;

const SIZES: ClubSize[] = ["small", "medium", "large"];
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
      {children}
    </section>
  );
}

async function Analysis({ searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const q = await searchParams;
  const t = await getTranslations("analytics");
  const tLic = await getTranslations("licensing.areas");
  const size = SIZES.find((s) => s === str(q.size)) ?? null;
  const season = str(q.season)?.match(/^\d{4}\/\d{4}$/) ? str(q.season) : null;
  let view;
  try {
    view = await getAnalytics(analyticsDeps, user, { season, union: str(q.union), size });
  } catch (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") {
      return <p className="text-sm">{t("forbidden")}</p>;
    }
    throw error;
  }

  const seasons = [
    ...new Set([
      currentSeason(),
      view.season,
      ...view.clubs.flatMap((c) => c.sportnet.map((s) => s.season)),
    ]),
  ]
    .sort()
    .reverse();
  const own = view.scope === "club";
  const lic = licensingAverages(view.clubs);
  const act = activityTotals(view.clubs);
  const trend = sportnetTrend(view.clubs);
  const areaLabels = Array.from({ length: 11 }, (_, i) => String(i + 1));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t(`scope.${view.scope}`, { count: view.clubs.length })}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{t("filters.season")}</span>
          <select
            name="season"
            defaultValue={view.season}
            className="rounded-md border px-2 py-1.5"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {!own && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{t("filters.union")}</span>
            <select
              name="union"
              defaultValue={str(q.union) ?? ""}
              className="max-w-48 rounded-md border px-2 py-1.5"
            >
              <option value="">{t("filters.all")}</option>
              {view.unions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
        {!own && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{t("filters.size")}</span>
            <select name="size" defaultValue={size ?? ""} className="rounded-md border px-2 py-1.5">
              <option value="">{t("filters.all")}</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {t(`sizes.${s}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" size="sm">
          {t("filters.apply")}
        </Button>
      </form>

      {view.clubs.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title={t("kompas.title")}
            note={
              own
                ? view.benchmark
                  ? t("kompas.benchmark", {
                      count: view.benchmark.clubs,
                      size: t(`sizes.${view.benchmark.size}`),
                    })
                  : t("kompas.noBenchmark")
                : view.scope === "mentor"
                  ? t("kompas.submittedOnly")
                  : undefined
            }
          >
            {own ? (
              <GroupedBars
                data={areaLabels.map((label, i) => ({
                  label,
                  own: view.clubs[0].kompas.areas[i],
                  ...(view.benchmark ? { benchmark: view.benchmark.kompas[i] } : {}),
                }))}
                series={[
                  { key: "own", label: view.clubs[0].name },
                  ...(view.benchmark ? [{ key: "benchmark", label: t("kompas.similar") }] : []),
                ]}
                max={20}
              />
            ) : (
              <KompasHeatmap clubs={view.clubs} average={view.average?.kompas ?? null} />
            )}
          </Panel>

          <Panel title={t("licensing.title")} note={t("licensing.note", { count: lic.clubs })}>
            {lic.clubs === 0 ? (
              <p className="text-muted-foreground text-sm">{t("licensing.none")}</p>
            ) : (
              <GroupedBars
                layout="vertical"
                height={240}
                data={lic.areas.map((a) => ({ label: tLic(a.key), points: a.points }))}
                series={[{ key: "points", label: t("licensing.points") }]}
              />
            )}
          </Panel>

          <Panel title={t("activity.title")}>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [t("activity.visits"), String(act.visits)],
                [t("activity.actions"), `${act.actionsDone}/${act.actionsTotal}`],
                [t("activity.goals"), `${act.planDone}/${act.planGoals}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            <GroupedBars
              layout="vertical"
              height={160}
              max={act.clubs}
              data={[
                { label: t("activity.kompasSubmitted"), value: act.kompasSubmitted },
                { label: t("activity.licensingClosed"), value: act.licensingClosed },
                { label: t("activity.withPlan"), value: act.withPlan },
              ]}
              series={[{ key: "value", label: t("activity.clubs", { count: act.clubs }) }]}
            />
          </Panel>

          <Panel title={t("sportnet.title")} note={t("sportnet.note")}>
            {trend.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("sportnet.none")}</p>
            ) : (
              <TrendLines
                data={trend}
                series={[
                  { key: "players", label: t("sportnet.players"), right: true },
                  { key: "coachesWithLicence", label: t("sportnet.coachesWithLicence") },
                  { key: "teamsWithoutCoach", label: t("sportnet.teamsWithoutCoach") },
                ]}
              />
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Analysis {...props} />
      </Suspense>
    </main>
  );
}
