import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { GroupedBars, TrendLines } from "@/components/analytics/charts";
import { KompasHeatmap } from "@/components/analytics/kompas-heatmap";
import { PanelBoard, PrintButton, type BoardPanel } from "@/components/analytics/panel-board";
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
/** comparison of at most 4 clubs (decision 22. 10. 2026) */
const MAX_COMPARE = 4;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
/** `clubs` comes as repeated checkboxes or as a comma list (shared links) */
const list = (v: string | string[] | undefined) => [
  ...new Set((Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).filter(Boolean)),
];

async function Analysis({ searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const q = await searchParams;
  const t = await getTranslations("analytics");
  const tLic = await getTranslations("licensing.areas");
  const format = await getFormatter();
  const size = SIZES.find((s) => s === str(q.size)) ?? null;
  const season = str(q.season)?.match(/^\d{4}\/\d{4}$/) ? str(q.season) : null;
  const union = str(q.union);
  const requested = list(q.clubs);
  const compare = requested.slice(0, MAX_COMPARE);
  let view;
  try {
    view = await getAnalytics(analyticsDeps, user, {
      season,
      union,
      size,
      clubs: compare.length > 0 ? compare : null,
    });
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
  const comparing = !own && compare.length > 0;
  const exportQuery = new URLSearchParams({
    format: "csv",
    season: view.season,
    ...(union ? { union } : {}),
    ...(size ? { size } : {}),
    ...(comparing ? { clubs: compare.join(",") } : {}),
  });
  const printed = [
    t("export.printed", {
      date: format.dateTime(new Date(), { dateStyle: "medium" }),
      season: view.season,
    }),
    union ? t("export.filterUnion", { union }) : null,
    size ? t("export.filterSize", { size: t(`sizes.${size}`) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const compared = comparing && view.clubs.length > 1 ? view.clubs : [];
  const seasonRow = (c: (typeof view.clubs)[number]) =>
    c.sportnet.find((s) => s.season === view.season);
  const panels: BoardPanel[] = [
    ...(compared.length > 0
      ? [
          {
            id: "compare",
            title: t("compare.title"),
            note: t("compare.note"),
            content: (
              <>
                <GroupedBars
                  data={areaLabels.map((label, i) => ({
                    label,
                    ...Object.fromEntries(compared.map((c, j) => [`c${j}`, c.kompas.areas[i]])),
                  }))}
                  series={compared.map((c, j) => ({ key: `c${j}`, label: c.name }))}
                  max={20}
                  height={260}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-left text-xs">
                        <th className="py-1 pr-2 font-normal">{t("compare.metric")}</th>
                        {compared.map((c) => (
                          <th key={c.clubId} className="max-w-28 px-2 py-1 font-medium">
                            <span className="line-clamp-2">{c.name}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {(
                        [
                          [
                            "kompasTotal",
                            (c) => (c.kompas.filledAreas > 0 ? c.kompas.total : null),
                          ],
                          [
                            "licensingPoints",
                            (c) => c.licensing?.reduce((sum, a) => sum + a.points, 0) ?? null,
                          ],
                          ["visits", (c) => c.activity.visits],
                          [
                            "actions",
                            (c) => `${c.activity.actionsDone}/${c.activity.actionsTotal}`,
                          ],
                          ["goals", (c) => `${c.activity.planDone}/${c.activity.planGoals}`],
                          ["players", (c) => seasonRow(c)?.players ?? null],
                          ["coachesWithLicence", (c) => seasonRow(c)?.coachesWithLicence ?? null],
                          ["teamsWithoutCoach", (c) => seasonRow(c)?.teamsWithoutCoach ?? null],
                        ] as const satisfies readonly (readonly [
                          string,
                          (c: (typeof compared)[number]) => string | number | null,
                        ])[]
                      ).map(([key, value]) => (
                        <tr key={key} className="border-t">
                          <td className="text-muted-foreground py-1.5 pr-2 text-xs">
                            {t(`compare.${key}`)}
                          </td>
                          {compared.map((c) => (
                            <td key={c.clubId} className="px-2 py-1.5">
                              {value(c) ?? "–"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ),
          },
        ]
      : []),
    {
      id: "kompas",
      title: t("kompas.title"),
      note: own
        ? view.benchmark
          ? t("kompas.benchmark", {
              count: view.benchmark.clubs,
              size: t(`sizes.${view.benchmark.size}`),
            })
          : t("kompas.noBenchmark")
        : view.scope === "mentor"
          ? t("kompas.submittedOnly")
          : undefined,
      content: own ? (
        <GroupedBars
          data={areaLabels.map((label, i) => ({
            label,
            own: view.clubs[0]?.kompas.areas[i] ?? null,
            ...(view.benchmark ? { benchmark: view.benchmark.kompas[i] } : {}),
          }))}
          series={[
            { key: "own", label: view.clubs[0]?.name ?? "" },
            ...(view.benchmark ? [{ key: "benchmark", label: t("kompas.similar") }] : []),
          ]}
          max={20}
        />
      ) : (
        <KompasHeatmap clubs={view.clubs} average={view.average?.kompas ?? null} />
      ),
    },
    {
      id: "licensing",
      title: t("licensing.title"),
      note: t("licensing.note", { count: lic.clubs }),
      content:
        lic.clubs === 0 ? (
          <p className="text-muted-foreground text-sm">{t("licensing.none")}</p>
        ) : (
          <GroupedBars
            layout="vertical"
            height={240}
            data={lic.areas.map((a) => ({ label: tLic(a.key), points: a.points }))}
            series={[{ key: "points", label: t("licensing.points") }]}
          />
        ),
    },
    {
      id: "activity",
      title: t("activity.title"),
      content: (
        <>
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
        </>
      ),
    },
    {
      id: "sportnet",
      title: t("sportnet.title"),
      note: t("sportnet.note"),
      content:
        trend.length === 0 ? (
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
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t(`scope.${view.scope}`, { count: view.clubs.length })}
        </p>
        <p className="text-muted-foreground hidden text-xs print:block">{printed}</p>
        <div className="mt-1 flex flex-wrap gap-2 print:hidden">
          <Button asChild size="sm" variant="outline">
            <a href={`/api/v1/analytics?${exportQuery}`} download>
              {t("export.csv")}
            </a>
          </Button>
          <PrintButton label={t("export.print")} />
        </div>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border p-3 text-sm print:hidden"
      >
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
        {!own && view.options.length > 1 && (
          <details className="w-full" open={comparing}>
            <summary className="cursor-pointer py-1 font-medium">
              {t("compare.pick")}{" "}
              <span className="text-muted-foreground font-normal">
                · {t("compare.picked", { count: compare.length })}
              </span>
            </summary>
            <p className="text-muted-foreground text-xs">{t("compare.pickHint")}</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {view.options.map((c) => (
                <label key={c.clubId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="clubs"
                    value={c.clubId}
                    defaultChecked={compare.includes(c.clubId)}
                    className="size-4"
                  />
                  <span className="min-w-0 truncate">
                    {c.name} <span className="text-muted-foreground text-xs">· {c.union}</span>
                  </span>
                </label>
              ))}
            </div>
            <Button type="submit" size="sm" variant="outline" className="mt-2 mr-3">
              {t("compare.submit")}
            </Button>
            {comparing && (
              <a
                href={`/analyza?season=${encodeURIComponent(view.season)}`}
                className="text-muted-foreground mt-2 inline-block text-xs underline underline-offset-4"
              >
                {t("compare.clear")}
              </a>
            )}
          </details>
        )}
      </form>
      {requested.length > MAX_COMPARE && !own && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t("compare.tooMany")}</p>
      )}

      {view.clubs.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          {t("empty")}
        </p>
      ) : (
        <PanelBoard panels={panels} />
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
