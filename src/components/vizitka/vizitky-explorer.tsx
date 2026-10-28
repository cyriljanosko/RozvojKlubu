"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  Accordion,
  AccordionItem,
  Alert,
  Avatar,
  Card,
  Chip,
  Icon,
  Input,
  Select,
  Tabs,
} from "@/components/sfz";
import { ConfirmedBadge, Milestones } from "@/components/vizitka/milestones";
import { Stars } from "@/components/vizitka/stars";
import {
  KOMPAS_MAX,
  RANK_SORTS,
  positionOf,
  sortClubs,
  topProgress,
  topThree,
  unionRatings,
  type RankSort,
} from "@/lib/rankings";
import {
  MAP_VIEWBOX,
  OBFZ,
  RFZ,
  countByArea,
  mapAreas,
  type MapLevel,
  type Rfz,
} from "@/lib/slovakia-map";
import type { RankingsViewer, VizitkaCard } from "@/server/services/vizitky.service";

const SIZES = ["small", "medium", "large"] as const;
const METRICS = ["count", "kompas", "licensing"] as const;
type Metric = (typeof METRICS)[number];
const VIEWS = ["map", "rankings"] as const;
type View = (typeof VIEWS)[number];

/** Choropleth fill on the SFZ blue scale: raised surface for nothing, lighter = fewer (design 26. 10.). */
const fillFor = (value: number | null, max: number) =>
  !value
    ? "var(--surface-raised)"
    : `color-mix(in oklch, var(--brand-blue-deep) ${Math.round(15 + 85 * (value / Math.max(max, 1)))}%, var(--brand-blue-tint))`;

const decimal = (n: number) => n.toLocaleString("sk", { maximumFractionDigits: 1 });
const href = (c: VizitkaCard) => `/vizitka/${encodeURIComponent(c.clubId)}`;

/**
 * Vizitky klubov (VK-a) with the rankings (VK-b, 26. 10. 2026): map of Slovakia by RFZ or ObFZ
 * coloured by the number of pilot clubs or their average stars, a click on an area filters;
 * under the map the search block – filters by name, RFZ, ObFZ and size, ordering by Kompas,
 * licensing, players, ObFZ or RFZ; the list of clubs appears only after a search or filter;
 * below the list the rankings by club size and the order of the unions.
 * Motivational rules (MR-b, ADR 0015): ratings only of clubs that consented, publicly the top 3
 * and the top 3 by progress of each size, the others without a position; the full position only
 * for the viewer's own clubs (management, coach), a mentor's clubs and admin_sfz.
 */
export function VizitkyExplorer({
  cards,
  viewer,
  initial,
}: {
  cards: VizitkaCard[];
  viewer: RankingsViewer;
  initial: { q: string; rfz: string; obfz: string; size: string; sort: string; view: string };
}) {
  const t = useTranslations("vizitky");
  const [view, setView] = useState<View>(initial.view === "rankings" ? "rankings" : "map");
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
  const ranked = useMemo(() => cards.filter((c) => c.ranked), [cards]);
  // the stars of the map follow the size filter – clubs compare with clubs of their size
  const ratings = useMemo(
    () =>
      unionRatings(
        ranked.filter((c) => !size || c.size === size),
        level,
      ),
    [ranked, level, size],
  );
  const seesPosition = (clubId: string) =>
    viewer.positions === "all" || viewer.positions.includes(clubId);
  const by = sort === "licensing" ? "licensing" : "kompas";
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
  // the list shows up only once the visitor searches or filters (decision 26. 10. 2026)
  const searching = Boolean(q || rfz || obfz || size);
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
      <span className="footnote text-(--ink-muted)">{t("stars.none")}</span>
    ) : (
      <span className="flex flex-wrap items-center gap-x-1.5">
        <Stars
          value={c.kompasStars}
          tone="kompas"
          label={t("stars.label", { value: c.kompasStars, rating: t("stars.kompas") })}
        />
        <span className="footnote text-(--ink-muted)">
          {t("stars.kompasPoints", { points: c.kompas ?? 0, max: KOMPAS_MAX })}
        </span>
        {c.confirmed && <ConfirmedBadge />}
      </span>
    );
  const licensing = (c: VizitkaCard) =>
    c.licensing === null || c.licensing.stars === null ? (
      <span className="footnote text-(--ink-muted)">{t("stars.none")}</span>
    ) : (
      <span className="flex flex-wrap items-center gap-x-1.5">
        <Stars
          value={c.licensing.stars}
          tone="licensing"
          label={t("stars.label", { value: c.licensing.stars, rating: t("stars.licensing") })}
        />
        <span className="footnote text-(--ink-muted)">
          {t("stars.licensingPoints", { points: decimal(c.licensing.points) })}
        </span>
      </span>
    );

  const rating = (c: VizitkaCard) =>
    !c.ranked ? (
      <span className="footnote text-(--ink-muted)">{t("list.notRanked")}</span>
    ) : (
      <span className="grid gap-1 sm:grid-cols-2">
        <span className="flex flex-col">
          <span className="caption-1 text-(--ink-muted)">{t("stars.kompas")}</span>
          {kompas(c)}
        </span>
        <span className="flex flex-col">
          <span className="caption-1 text-(--ink-muted)">{t("stars.licensing")}</span>
          {licensing(c)}
        </span>
      </span>
    );
  const place = (c: VizitkaCard) =>
    c.place ? `${c.place.obfz} · ${c.place.rfz}` : t("list.noPlace");

  const mapPanel = (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("map.level")} className="flex flex-wrap gap-2">
        {(["rfz", "obfz"] as const).map((l) => (
          <Chip key={l} selected={level === l} onClick={() => setLevel(l)}>
            {t(`map.${l}`)}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label={t("map.metric")} className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <Chip key={m} selected={metric === m} onClick={() => setMetric(m)}>
            {t(`map.${m}`)}
          </Chip>
        ))}
      </div>
      <div className="rounded-(--radius-lg) bg-(--surface-raised) p-3">
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
                    stroke={active ? "var(--ink)" : "var(--surface)"}
                    strokeWidth={active ? 2.5 : 1}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="footnote min-h-5 text-(--ink-muted)" aria-live="polite">
        {hover
          ? describe(hover)
          : selected
            ? t("map.selected", { name: name(selected) })
            : metric === "count"
              ? t("map.legend")
              : t("map.legendStars", { metric: t(`map.${metric}`) })}
      </p>
      <p className="caption-1 text-(--ink-muted)">{t("map.source")}</p>

      <Card
        title={t(`rankings.unions.title.${level}`)}
        flush
        footer={<span className="footnote text-(--ink-muted)">{t("rankings.unions.intro")}</span>}
      >
        {ratings.length === 0 ? (
          <p className="callout px-4 pb-4 text-(--ink-muted)">{t("rankings.empty")}</p>
        ) : (
          <ol>
            {ratings.map((r, i) => (
              <li key={r.id} className="border-t border-(--hairline) first:border-t-0">
                <button
                  type="button"
                  aria-pressed={selected === r.id}
                  onClick={() => pick(r.id)}
                  className="flex min-h-(--touch-target) w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left aria-pressed:bg-(--brand-blue-tint)"
                >
                  <span className="headline w-6 text-(--ink-muted)">{i + 1}.</span>
                  <span className="subheadline min-w-0 flex-1">
                    {name(r.id)}{" "}
                    <span className="footnote text-(--ink-muted)">
                      · {t("map.clubs", { count: r.clubs })}
                    </span>
                  </span>
                  <span className="footnote flex gap-3 font-semibold whitespace-nowrap text-(--brand-blue-ink)">
                    <span>
                      {r.kompas === null ? "–" : `${decimal(r.kompas)} ★`}
                      <span className="sr-only"> {t("stars.kompas")}</span>
                    </span>
                    <span>
                      {r.licensing === null ? "–" : `${decimal(r.licensing)} ★`}
                      <span className="sr-only"> {t("stars.licensing")}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );

  const rankingsPanel = (
    <div className="flex flex-col gap-4">
      <p className="callout text-(--ink-muted)">{t("rankings.intro")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t("filters.size")}
          value={size}
          onChange={(e) => setSize(e.target.value)}
          options={[
            { value: "", label: t("filters.all") },
            ...SIZES.map((s) => ({ value: s, label: t(`sizes.${s}`) })),
          ]}
        />
        <Select
          label={t("sort.label")}
          value={by}
          onChange={(e) => setSort(e.target.value as RankSort)}
          options={(["kompas", "licensing"] as const).map((s) => ({
            value: s,
            label: t(`sort.${s}`),
          }))}
        />
      </div>
      {viewer.own.map((id) => {
        const c = cards.find((x) => x.clubId === id);
        if (!c) return null;
        const pos = c.ranked
          ? positionOf(
              ranked.filter((x) => x.size === c.size),
              id,
              sort,
            )
          : null;
        return (
          <Alert key={id} tone="info">
            {!c.ranked
              ? t("rankings.own.notRanked", { name: c.name })
              : pos
                ? t("rankings.own.position", {
                    name: c.name,
                    position: pos.position,
                    of: pos.of,
                    size: c.size ? t(`sizes.${c.size}`) : "",
                    by: t(`stars.${by}`),
                  })
                : t("rankings.own.noValue", { name: c.name, by: t(`stars.${by}`) })}
          </Alert>
        );
      })}
      {ranked.length === 0 ? (
        <p className="callout text-(--ink-muted)">{t("rankings.noneYet")}</p>
      ) : (
        (["large", "medium", "small"] as const)
          .filter((s) => !size || s === size)
          .map((s) => {
            const pool = ranked.filter((c) => c.size === s && matches(c));
            const top = topThree(pool, sort);
            const climbers = topProgress(pool);
            // alphabetically – the public order of the rest says nothing about their rank
            const others = pool
              .filter((c) => !top.includes(c))
              .sort((a, b) => a.name.localeCompare(b.name, "sk"));
            return (
              <section
                key={s}
                className="flex flex-col gap-3"
                aria-label={t(`rankings.sizes.${s}`)}
              >
                <Card
                  title={`${t("rankings.topShort")} · ${t(`rankings.sizes.${s}`)}`}
                  flush
                  footer={
                    <span className="footnote text-(--ink-muted)">
                      {t("rankings.top", { by: t(`stars.${by}`) })}
                    </span>
                  }
                >
                  {pool.length === 0 || top.length === 0 ? (
                    <p className="callout px-4 pb-4 text-(--ink-muted)">
                      {pool.length === 0 ? t("rankings.empty") : t("stars.none")}
                    </p>
                  ) : (
                    <ol>
                      {top.map((c, i) => (
                        <li
                          key={c.clubId}
                          className="border-t border-(--hairline) first:border-t-0"
                        >
                          <Link
                            href={href(c)}
                            className="flex items-start gap-3 px-4 py-3 text-(--ink) no-underline"
                          >
                            <span className="title-3 w-6 shrink-0 text-(--brand-blue-ink)">
                              {i + 1}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="headline break-words">{c.name}</span>
                              <span className="footnote text-(--ink-muted)">
                                {place(c)}
                                {c.players !== null &&
                                  ` · ${t("list.players", { count: c.players })}`}
                              </span>
                              {rating(c)}
                              <Milestones reached={c.milestones} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
                {climbers.length > 0 && (
                  <Card title={t("rankings.progress.title")} variant="highlight">
                    <ol className="callout flex flex-col gap-2">
                      {climbers.map((c, i) => (
                        <li key={c.clubId} className="flex flex-wrap gap-x-2">
                          <span className="font-semibold text-(--ink-muted)">{i + 1}.</span>
                          <Link href={href(c)} className="font-semibold">
                            {c.name}
                          </Link>
                          <span>
                            {t("rankings.progress.value", {
                              points: c.progress!.points,
                              from: c.progress!.fromStars,
                              to: c.progress!.toStars,
                            })}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}
                {others.length > 0 && (
                  <Accordion>
                    <AccordionItem
                      title={t("rankings.others")}
                      subtitle={t("list.count", { count: others.length })}
                    >
                      <ul className="flex flex-col gap-3">
                        {others.map((c) => {
                          const pos = seesPosition(c.clubId)
                            ? positionOf(pool, c.clubId, sort)
                            : null;
                          return (
                            <li key={c.clubId} className="flex flex-col gap-1">
                              <span className="flex flex-wrap items-baseline gap-x-2">
                                <Link href={href(c)} className="subheadline font-semibold">
                                  {c.name}
                                </Link>
                                {pos && (
                                  <span className="footnote text-(--ink-muted)">
                                    {t("rankings.position", {
                                      position: pos.position,
                                      of: pos.of,
                                    })}
                                  </span>
                                )}
                              </span>
                              {rating(c)}
                              <Milestones reached={c.milestones} />
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionItem>
                  </Accordion>
                )}
              </section>
            );
          })
      )}
      <Accordion>
        <AccordionItem title={t("rankings.rule.title")}>
          <div className="callout flex flex-col gap-2">
            <p>{t("rankings.rule.kompas")}</p>
            <p>{t("rankings.rule.licensing")}</p>
            <p>{t("rankings.rule.consent")}</p>
            <p>{t("rankings.rule.progress")}</p>
            <p>{t("rankings.rule.milestones")}</p>
            <Milestones reached={[]} variant="legend" />
            <p className="footnote text-(--ink-muted)">{t("rankings.rule.note")}</p>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );

  const activeFilters = [
    rfz && {
      key: "rfz",
      label: t(`rfzNames.${rfz as Rfz}`),
      clear: () => (setRfz(""), setObfz("")),
    },
    obfz && { key: "obfz", label: obfz, clear: () => setObfz("") },
    size && {
      key: "size",
      label: t(`sizes.${size as (typeof SIZES)[number]}`),
      clear: () => setSize(""),
    },
  ].filter((f): f is { key: string; label: string; clear: () => void } => Boolean(f));

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        items={VIEWS.map((v) => ({ id: v, label: t(`views.${v}`) }))}
        value={view}
        onChange={(id) => setView(id as View)}
        variant="segmented"
        aria-label={t("views.label")}
      />
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
        {view === "map" ? mapPanel : rankingsPanel}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="clubs-search">
        <h2 id="clubs-search" className="title-3">
          {t("list.title")}
        </h2>
        <Input
          type="search"
          icon="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("filters.searchPlaceholder")}
          aria-label={t("filters.search")}
        />
        <Accordion>
          <AccordionItem title={t("filters.title")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("filters.rfz")}
                value={rfz}
                onChange={(e) => {
                  setRfz(e.target.value);
                  setObfz("");
                }}
                options={[
                  { value: "", label: t("filters.all") },
                  ...RFZ.map((r) => ({ value: r, label: t(`rfzNames.${r}`) })),
                ]}
              />
              <Select
                label={t("filters.obfz")}
                value={obfz}
                onChange={(e) => {
                  setObfz(e.target.value);
                  if (e.target.value) setRfz(OBFZ.find((o) => o.id === e.target.value)?.rfz ?? "");
                }}
                options={[
                  { value: "", label: t("filters.all") },
                  ...obfzOptions.map((o) => ({ value: o.id, label: o.id })),
                ]}
              />
              <Select
                label={t("filters.size")}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                options={[
                  { value: "", label: t("filters.all") },
                  ...SIZES.map((s) => ({ value: s, label: t(`sizes.${s}`) })),
                ]}
              />
              <Select
                label={t("sort.label")}
                value={sort}
                onChange={(e) => setSort(e.target.value as RankSort)}
                options={RANK_SORTS.map((s) => ({ value: s, label: t(`sort.${s}`) }))}
              />
            </div>
          </AccordionItem>
        </Accordion>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f) => (
              <Chip key={f.key} selected onRemove={f.clear}>
                {f.label}
              </Chip>
            ))}
          </div>
        )}

        {!searching ? (
          <p className="callout rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink-muted)">
            {t("list.hint")}
          </p>
        ) : shown.length === 0 ? (
          <p className="callout rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink-muted)">
            {t("list.empty")}
          </p>
        ) : (
          <>
            <p className="footnote text-(--ink-muted)">
              {t("list.count", { count: shown.length })}
            </p>
            <ol className="grid gap-2 lg:grid-cols-2">
              {shown.map((c) => (
                <li key={c.clubId}>
                  <Link
                    href={href(c)}
                    className="flex items-center gap-3 rounded-(--radius-md) bg-(--surface-raised) px-4 py-3 text-(--ink) no-underline"
                  >
                    <Avatar name={c.name} size="md" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="headline break-words">{c.name}</span>
                      <span className="footnote text-(--ink-muted)">
                        {[
                          place(c),
                          c.size ? t(`sizes.${c.size}`) : null,
                          c.players !== null ? t("list.players", { count: c.players }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {rating(c)}
                    </span>
                    <span className="text-(--ink-muted)" aria-hidden>
                      <Icon name="chevron-right" size={18} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
