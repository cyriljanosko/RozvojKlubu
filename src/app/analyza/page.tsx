import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { GroupedBars, TrendLines } from "@/components/analytics/charts";
import { KompasHeatmap } from "@/components/analytics/kompas-heatmap";
import { NetworkGraph } from "@/components/analytics/network-graph";
import { PanelBoard, PrintButton, type BoardPanel } from "@/components/analytics/panel-board";
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Icon,
  LinkButton,
  LinkChip,
  Select,
} from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { analyticsDeps, networkDeps } from "@/server/clubs/deps";
import {
  activityTotals,
  getAnalytics,
  licensingAverages,
  sportnetTrend,
  type ClubSize,
} from "@/server/services/analytics.service";
import { getNetwork, type NetworkView } from "@/server/services/network.service";
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
      return (
        <EmptyState
          title={t("forbidden")}
          action={<LinkButton href="/moja-akademia">{t("back")}</LinkButton>}
        />
      );
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

  // network graph (DA-d): the club map by default for club roles, the Academy map otherwise
  const map = str(q.mapa) === "klub" || (own && str(q.mapa) !== "akademia") ? "club" : "academy";
  const networkClub = own
    ? null
    : (view.options.find((c) => c.clubId === str(q.klub)) ??
      view.options.find((c) => c.clubId === compare[0]) ??
      view.options[0] ??
      null);
  let network: NetworkView | null = null;
  try {
    network = await getNetwork(networkDeps, user, {
      map,
      clubId: networkClub?.clubId ?? null,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
      for (const x of Array.isArray(v) ? v : v ? [v] : [])
        if (k !== "mapa" && k !== "klub") p.append(k, x);
    }
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/analyza?${p}`;
  };
  const tNet = await getTranslations("analytics.network");

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
                  <table className="subheadline w-full">
                    <thead>
                      <tr className="footnote text-left text-(--ink-muted)">
                        <th className="py-1.5 pr-2 font-normal">{t("compare.metric")}</th>
                        {compared.map((c) => (
                          <th key={c.clubId} className="max-w-28 px-2 py-1.5 font-semibold">
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
                        <tr key={key} className="border-t border-(--hairline)">
                          <td className="footnote py-1.5 pr-2 text-(--ink-muted)">
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
          <p className="callout text-(--ink-muted)">{t("licensing.none")}</p>
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
              <div key={label} className="rounded-(--radius-sm) bg-(--surface) p-2">
                <p className="footnote text-(--ink-muted)">{label}</p>
                <p className="title-3 tabular-nums">{value}</p>
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
      id: "network",
      title: tNet("title"),
      note:
        map === "academy"
          ? tNet("noteAcademy")
          : network?.people
            ? tNet("noteClub")
            : tNet("noteClubNoPeople"),
      content: (
        <>
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <div className="flex gap-2">
              {(["academy", "club"] as const).map((m) => (
                <LinkChip
                  key={m}
                  href={keep({
                    mapa: m === "club" ? "klub" : "akademia",
                    ...(m === "club" && networkClub ? { klub: networkClub.clubId } : {}),
                  })}
                  selected={map === m}
                >
                  {tNet(m)}
                </LinkChip>
              ))}
            </div>
            {map === "club" && !own && view.options.length > 1 && (
              <form method="get" action="/analyza" className="flex items-end gap-2">
                {Object.entries(q).flatMap(([k, v]) =>
                  k === "mapa" || k === "klub"
                    ? []
                    : (Array.isArray(v) ? v : v ? [v] : []).map((x, i) => (
                        <input key={`${k}-${i}`} type="hidden" name={k} value={x} />
                      )),
                )}
                <input type="hidden" name="mapa" value="klub" />
                <Select
                  name="klub"
                  label={tNet("pickClub")}
                  defaultValue={networkClub?.clubId}
                  options={view.options.map((c) => ({ value: c.clubId, label: c.name }))}
                />
                <Button type="submit" size="sm" variant="secondary">
                  {tNet("show")}
                </Button>
              </form>
            )}
          </div>
          {network ? (
            <NetworkGraph
              key={`${network.map}-${network.club?.clubId ?? ""}`}
              nodes={network.nodes}
              edges={network.edges}
              club={network.map === "club"}
            />
          ) : (
            <p className="callout text-(--ink-muted)">{tNet("unavailable")}</p>
          )}
        </>
      ),
    },
    {
      id: "sportnet",
      title: t("sportnet.title"),
      note: t("sportnet.note"),
      content:
        trend.length === 0 ? (
          <p className="callout text-(--ink-muted)">{t("sportnet.none")}</p>
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

  const kpis = [
    { key: "clubs", value: String(act.clubs) },
    { key: "kompas", value: String(act.kompasSubmitted) },
    { key: "licensing", value: String(act.licensingClosed) },
    { key: "plan", value: String(act.withPlan) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
          <h1 className="large-title">{t("title")}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{t(`scopeBadge.${view.scope}`)}</Badge>
            <span className="footnote text-(--ink-muted)">
              {t(`scope.${view.scope}`, { count: view.clubs.length })}
            </span>
          </div>
          <p className="footnote hidden text-(--ink-muted) print:block">{printed}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a
            href={`/api/v1/analytics?${exportQuery}`}
            download
            className="sfz-btn sfz-btn--secondary sfz-btn--sm no-underline"
          >
            <Icon name="download" size={16} />
            {t("export.csv")}
          </a>
          <PrintButton label={t("export.print")} />
        </div>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-(--radius-md) bg-(--surface-raised) p-4 print:hidden"
      >
        <div className="min-w-0 flex-[1_1_160px]">
          <Select
            name="season"
            label={t("filters.season")}
            defaultValue={view.season}
            options={seasons.map((s) => ({ value: s, label: s }))}
          />
        </div>
        {!own && (
          <div className="min-w-0 flex-[1_1_160px]">
            <Select
              name="union"
              label={t("filters.union")}
              defaultValue={str(q.union) ?? ""}
              options={[
                { value: "", label: t("filters.all") },
                ...view.unions.map((u) => ({ value: u, label: u })),
              ]}
            />
          </div>
        )}
        {!own && (
          <div className="min-w-0 flex-[1_1_160px]">
            <Select
              name="size"
              label={t("filters.size")}
              defaultValue={size ?? ""}
              options={[
                { value: "", label: t("filters.all") },
                ...SIZES.map((s) => ({ value: s, label: t(`sizes.${s}`) })),
              ]}
            />
          </div>
        )}
        <Button type="submit">{t("filters.apply")}</Button>
        {!own && view.options.length > 1 && (
          <div className="w-full">
            <Accordion>
              <AccordionItem
                title={t("compare.pick")}
                subtitle={t("compare.picked", { count: compare.length })}
                defaultOpen={comparing}
              >
                <div className="flex flex-col gap-2">
                  <p className="footnote text-(--ink-muted)">{t("compare.pickHint")}</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3">
                    {view.options.map((c) => (
                      <Checkbox
                        key={c.clubId}
                        name="clubs"
                        value={c.clubId}
                        defaultChecked={compare.includes(c.clubId)}
                        label={c.name}
                        description={c.union}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" size="sm" variant="secondary">
                      {t("compare.submit")}
                    </Button>
                    {comparing && (
                      <a
                        href={`/analyza?season=${encodeURIComponent(view.season)}`}
                        className="subheadline"
                      >
                        {t("compare.clear")}
                      </a>
                    )}
                  </div>
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </form>
      {requested.length > MAX_COMPARE && !own && (
        <Alert tone="warning">{t("compare.tooMany")}</Alert>
      )}

      {view.clubs.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          {!own && (
            <section
              className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-3"
              aria-label={t("kpi.label")}
            >
              {kpis.map((k) => (
                <div
                  key={k.key}
                  className="flex flex-col gap-1 rounded-(--radius-lg) bg-(--surface-raised) p-4"
                >
                  <span className="label text-(--ink-muted)">{t(`kpi.${k.key}`)}</span>
                  <span className="large-title tabular-nums">{k.value}</span>
                  <span className="footnote text-(--ink-muted)">
                    {k.key === "clubs"
                      ? t("kpi.clubsNote", { unions: new Set(view.clubs.map((c) => c.union)).size })
                      : t("kpi.ofClubs", { count: act.clubs })}
                  </span>
                </div>
              ))}
            </section>
          )}
          <PanelBoard panels={panels} />
        </>
      )}
    </div>
  );
}

export default function AnalysisPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Analysis {...props} />
      </Suspense>
    </main>
  );
}
