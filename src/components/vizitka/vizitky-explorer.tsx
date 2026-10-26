"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Stars } from "@/components/vizitka/stars";
import { KOMPAS_MAX, RANK_SORTS, sortClubs, unionRatings, type RankSort } from "@/lib/rankings";
import {
  MAP_VIEWBOX,
  OBFZ,
  RFZ,
  countByArea,
  mapAreas,
  type MapLevel,
  type Rfz,
} from "@/lib/slovakia-map";
import type { VizitkaCard } from "@/server/services/vizitky.service";

const SIZES = ["small", "medium", "large"] as const;
const METRICS = ["count", "kompas", "licensing"] as const;
type Metric = (typeof METRICS)[number];
const field =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

/** Choropleth fill: muted for nothing, then light to deep blue by the share (blue-600, as charts). */
const fillFor = (value: number | null, max: number) =>
  !value
    ? "var(--muted)"
    : `color-mix(in oklch, #2563eb ${Math.round(35 + 65 * (value / Math.max(max, 1)))}%, var(--background))`;

const decimal = (n: number) => n.toLocaleString("sk", { maximumFractionDigits: 1 });
const href = (c: VizitkaCard) => `/vizitka/${encodeURIComponent(c.clubId)}`;

/**
 * Vizitky klubov (VK-a) with the rankings (VK-b, 26. 10. 2026): map of Slovakia by RFZ or ObFZ
 * coloured by the number of pilot clubs or their average stars, a click on an area filters;
 * filters by name, RFZ, ObFZ and size, ordering by Kompas, licensing, players, ObFZ or RFZ;
 * below the list the rankings by club size and the order of the unions.
 */
export function VizitkyExplorer({
  cards,
  initial,
}: {
  cards: VizitkaCard[];
  initial: { q: string; rfz: string; obfz: string; size: string; sort: string };
}) {
  const t = useTranslations("vizitky");
  const [level, setLevel] = useState<MapLevel>(initial.obfz ? "obfz" : "rfz");
  const [metric, setMetric] = useState<Metric>("count");
  const [q, setQ] = useState(initial.q);
  const [rfz, setRfz] = useState(initial.rfz);
  const [obfz, setObfz] = useState(initial.obfz);
  const [size, setSize] = useState(initial.size);
  const [sort, setSort] = useState<RankSort>(
    (RANK_SORTS as readonly string[]).includes(initial.sort)
      ? (initial.sort as RankSort)
      : "kompas",
  );
  const [hover, setHover] = useState<string | null>(null);

  const areas = useMemo(() => mapAreas(level), [level]);
  const counts = useMemo(
    () =>
      countByArea(
        cards.map((c) => c.place),
        level,
      ),
    [cards, level],
  );
  // the stars of the map follow the size filter – clubs compare with clubs of their size
  const ratings = useMemo(
    () =>
      unionRatings(
        cards.filter((c) => !size || c.size === size),
        level,
      ),
    [cards, level, size],
  );
  const valueOf = (id: string): number | null =>
    metric === "count"
      ? (counts.get(id) ?? 0)
      : (ratings.find((r) => r.id === id)?.[metric] ?? null);
  const max = metric === "count" ? Math.max(0, ...counts.values()) : 5;
  const selected = level === "rfz" ? rfz : obfz;
  const obfzOptions = OBFZ.filter((o) => !rfz || o.rfz === rfz);

  const matches = (c: VizitkaCard) =>
    (!q || c.name.toLocaleLowerCase("sk").includes(q.toLocaleLowerCase("sk"))) &&
    (!rfz || c.place?.rfz === rfz) &&
    (!obfz || c.place?.obfz === obfz);
  const shown = sortClubs(
    cards.filter((c) => matches(c) && (!size || c.size === size)),
    sort,
  );

  const pick = (id: string, at: MapLevel = level) => {
    if (at === "rfz") {
      setRfz(rfz === id ? "" : id);
      setObfz("");
    } else {
      setObfz(obfz === id ? "" : id);
      setRfz(OBFZ.find((o) => o.id === id)?.rfz ?? "");
    }
  };
  const name = (id: string) => (level === "rfz" ? t(`rfzNames.${id as Rfz}`) : id);
  const describe = (id: string) => {
    const v = valueOf(id);
    if (metric === "count") return `${name(id)}: ${t("map.clubs", { count: v ?? 0 })}`;
    return v === null
      ? `${name(id)}: ${t("map.noStars")}`
      : `${name(id)}: ${t("map.average", { value: decimal(v), metric: t(`map.${metric}`) })}`;
  };

  const kompas = (c: VizitkaCard) =>
    c.kompasStars === null ? (
      <span className="text-muted-foreground text-xs">{t("list.kompasNone")}</span>
    ) : (
      <span className="flex flex-wrap items-center gap-x-1.5">
        <Stars
          value={c.kompasStars}
          tone="kompas"
          label={t("stars.label", { value: c.kompasStars, rating: t("stars.kompas") })}
        />
        <span className="text-muted-foreground text-xs">
          {t("stars.kompasPoints", { points: c.kompas ?? 0, max: KOMPAS_MAX })}
        </span>
      </span>
    );
  const licensing = (c: VizitkaCard) =>
    c.licensing === null || c.licensing.stars === null ? (
      <span className="text-muted-foreground text-xs">{t("list.licensingNone")}</span>
    ) : (
      <span className="flex flex-wrap items-center gap-x-1.5">
        <Stars
          value={c.licensing.stars}
          tone="licensing"
          label={t("stars.label", { value: c.licensing.stars, rating: t("stars.licensing") })}
        />
        <span className="text-muted-foreground text-xs">
          {t("stars.licensingPoints", { points: decimal(c.licensing.points) })}
        </span>
      </span>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <section className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("map.title")}</h2>
            <div
              role="group"
              aria-label={t("map.level")}
              className="grid grid-cols-2 overflow-hidden rounded-md border text-xs"
            >
              {(["rfz", "obfz"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                  className="aria-pressed:bg-primary aria-pressed:text-primary-foreground px-3 py-1.5"
                >
                  {t(`map.${l}`)}
                </button>
              ))}
            </div>
          </div>
          <div
            role="group"
            aria-label={t("map.metric")}
            className="grid grid-cols-3 overflow-hidden rounded-md border text-xs"
          >
            {METRICS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className="aria-pressed:bg-primary aria-pressed:text-primary-foreground px-2 py-1.5"
              >
                {t(`map.${m}`)}
              </button>
            ))}
          </div>
          <svg
            viewBox={MAP_VIEWBOX}
            className="h-auto w-full"
            role="group"
            aria-label={t("map.title")}
          >
            {areas.map((a) => {
              const active = selected === a.id || hover === a.id;
              return (
                <g
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === a.id}
                  aria-label={describe(a.id)}
                  onClick={() => pick(a.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(a.id);
                    }
                  }}
                  onMouseEnter={() => setHover(a.id)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer focus:outline-none"
                >
                  <title>{describe(a.id)}</title>
                  {a.paths.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      style={{ fill: fillFor(valueOf(a.id), max), transition: "fill .15s" }}
                      stroke={active ? "var(--destructive)" : "var(--background)"}
                      strokeWidth={active ? 2.5 : 1}
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          <p className="text-muted-foreground min-h-5 text-xs" aria-live="polite">
            {hover
              ? describe(hover)
              : selected
                ? t("map.selected", { name: name(selected) })
                : metric === "count"
                  ? t("map.legend")
                  : t("map.legendStars", { metric: t(`map.${metric}`) })}
          </p>
          <p className="text-muted-foreground text-[11px]">{t("map.source")}</p>
        </section>

        <section className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-muted-foreground">{t("filters.search")}</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{t("filters.rfz")}</span>
              <select
                value={rfz}
                onChange={(e) => {
                  setRfz(e.target.value);
                  setObfz("");
                }}
                className={field}
              >
                <option value="">{t("filters.all")}</option>
                {RFZ.map((r) => (
                  <option key={r} value={r}>
                    {t(`rfzNames.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{t("filters.obfz")}</span>
              <select
                value={obfz}
                onChange={(e) => {
                  setObfz(e.target.value);
                  if (e.target.value) setRfz(OBFZ.find((o) => o.id === e.target.value)?.rfz ?? "");
                }}
                className={field}
              >
                <option value="">{t("filters.all")}</option>
                {obfzOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{t("filters.size")}</span>
              <select value={size} onChange={(e) => setSize(e.target.value)} className={field}>
                <option value="">{t("filters.all")}</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sizes.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{t("sort.label")}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as RankSort)}
                className={field}
              >
                {RANK_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            {(q || rfz || obfz || size) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setRfz("");
                  setObfz("");
                  setSize("");
                }}
                className="self-end justify-self-start text-xs underline underline-offset-4"
              >
                {t("filters.clear")}
              </button>
            )}
          </div>

          <h2 className="font-semibold">
            {t("list.title")}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              · {t("list.count", { count: shown.length })}
            </span>
          </h2>
          {shown.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
              {t("list.empty")}
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {shown.map((c, i) => (
                <li key={c.clubId}>
                  <Link
                    href={href(c)}
                    className="hover:bg-muted/50 flex gap-3 rounded-lg border p-3 text-sm"
                  >
                    <span className="text-muted-foreground w-6 shrink-0 font-semibold">
                      {i + 1}.
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium break-words">{c.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {[
                          c.place ? `${c.place.obfz} · ${c.place.rfz}` : t("list.noPlace"),
                          c.size ? t(`sizes.${c.size}`) : null,
                          c.players !== null ? t("list.players", { count: c.players }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="grid gap-1 sm:grid-cols-2">
                        <span className="flex flex-col">
                          <span className="text-muted-foreground text-[11px]">
                            {t("stars.kompas")}
                          </span>
                          {kompas(c)}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-muted-foreground text-[11px]">
                            {t("stars.licensing")}
                          </span>
                          {licensing(c)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="rankings-title">
        <div className="flex flex-col gap-1">
          <h2 id="rankings-title" className="text-xl font-semibold tracking-tight">
            {t("rankings.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">{t("rankings.intro")}</p>
        </div>
        {(["large", "medium", "small"] as const)
          .filter((s) => !size || s === size)
          .map((s) => {
            const rows = sortClubs(
              cards.filter((c) => c.size === s && matches(c)),
              sort,
            );
            return (
              <div key={s} className="flex flex-col gap-2">
                <h3 className="font-semibold">{t(`rankings.sizes.${s}`)}</h3>
                {rows.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                    {t("rankings.empty")}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
                        <tr>
                          <th className="w-10 px-3 py-2 font-medium">
                            {t("rankings.columns.rank")}
                          </th>
                          <th className="px-3 py-2 font-medium">{t("rankings.columns.club")}</th>
                          <th className="px-3 py-2 font-medium">{t("rankings.columns.union")}</th>
                          <th className="px-3 py-2 font-medium">{t("rankings.columns.players")}</th>
                          <th className="px-3 py-2 font-medium">{t("stars.kompas")}</th>
                          <th className="px-3 py-2 font-medium">{t("stars.licensing")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((c, i) => (
                          <tr key={c.clubId} className="border-t">
                            <td className="text-muted-foreground px-3 py-2 font-semibold">
                              {i + 1}.
                            </td>
                            <td className="px-3 py-2">
                              <Link
                                href={href(c)}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {c.name}
                              </Link>
                            </td>
                            <td className="text-muted-foreground px-3 py-2">
                              {c.place ? `${c.place.obfz} · ${c.place.rfz}` : t("list.noPlace")}
                            </td>
                            <td className="text-muted-foreground px-3 py-2">{c.players ?? "–"}</td>
                            <td className="px-3 py-2">{kompas(c)}</td>
                            <td className="px-3 py-2">{licensing(c)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-4" aria-labelledby="unions-title">
        <div className="flex flex-col gap-1">
          <h2 id="unions-title" className="font-semibold">
            {t(`rankings.unions.title.${level}`)}
          </h2>
          <p className="text-muted-foreground text-xs">{t("rankings.unions.intro")}</p>
        </div>
        {ratings.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("rankings.empty")}</p>
        ) : (
          <ol className="flex flex-col">
            {ratings.map((r, i) => (
              <li key={r.id} className="border-t first:border-t-0">
                <button
                  type="button"
                  aria-pressed={selected === r.id}
                  onClick={() => pick(r.id)}
                  className="hover:bg-muted/50 aria-pressed:bg-muted flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left text-sm"
                >
                  <span className="text-muted-foreground w-6 font-semibold">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {name(r.id)}{" "}
                    <span className="text-muted-foreground text-xs">
                      · {t("map.clubs", { count: r.clubs })}
                    </span>
                  </span>
                  <span className="flex gap-3 text-xs whitespace-nowrap">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {r.kompas === null ? "–" : `${decimal(r.kompas)} ★`}
                      <span className="sr-only"> {t("stars.kompas")}</span>
                    </span>
                    <span className="font-semibold text-orange-700 dark:text-orange-400">
                      {r.licensing === null ? "–" : `${decimal(r.licensing)} ★`}
                      <span className="sr-only"> {t("stars.licensing")}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="group rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{t("rankings.rule.title")}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <p>{t("rankings.rule.kompas")}</p>
          <p>{t("rankings.rule.licensing")}</p>
          <p className="text-muted-foreground text-xs">{t("rankings.rule.note")}</p>
        </div>
      </details>
    </div>
  );
}
