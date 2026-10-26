"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

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
const field =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

/** Choropleth fill: muted for no club, then light to deep blue by the count (blue-600, as charts). */
const fillFor = (count: number, max: number) =>
  count === 0
    ? "var(--muted)"
    : `color-mix(in oklch, #2563eb ${Math.round(35 + 65 * (count / Math.max(max, 1)))}%, var(--background))`;

/**
 * Vizitky klubov (VK-a): map of Slovakia by RFZ or ObFZ coloured by the number of pilot clubs,
 * a click on an area filters the list; filters by name, RFZ, ObFZ and size.
 */
export function VizitkyExplorer({
  cards,
  initial,
}: {
  cards: VizitkaCard[];
  initial: { q: string; rfz: string; obfz: string; size: string };
}) {
  const t = useTranslations("vizitky");
  const [level, setLevel] = useState<MapLevel>(initial.obfz ? "obfz" : "rfz");
  const [q, setQ] = useState(initial.q);
  const [rfz, setRfz] = useState(initial.rfz);
  const [obfz, setObfz] = useState(initial.obfz);
  const [size, setSize] = useState(initial.size);
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
  const max = Math.max(0, ...counts.values());
  const selected = level === "rfz" ? rfz : obfz;
  const obfzOptions = OBFZ.filter((o) => !rfz || o.rfz === rfz);

  const shown = cards.filter(
    (c) =>
      (!q || c.name.toLocaleLowerCase("sk").includes(q.toLocaleLowerCase("sk"))) &&
      (!rfz || c.place?.rfz === rfz) &&
      (!obfz || c.place?.obfz === obfz) &&
      (!size || c.size === size),
  );

  const pick = (id: string) => {
    if (level === "rfz") {
      setRfz(rfz === id ? "" : id);
      setObfz("");
    } else {
      setObfz(obfz === id ? "" : id);
      setRfz(OBFZ.find((o) => o.id === id)?.rfz ?? "");
    }
  };
  const name = (id: string) => (level === "rfz" ? t(`rfzNames.${id as Rfz}`) : id);

  return (
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
        <svg
          viewBox={MAP_VIEWBOX}
          className="h-auto w-full"
          role="group"
          aria-label={t("map.title")}
        >
          {areas.map((a) => {
            const count = counts.get(a.id) ?? 0;
            const active = selected === a.id || hover === a.id;
            return (
              <g
                key={a.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected === a.id}
                aria-label={`${name(a.id)}: ${t("map.clubs", { count })}`}
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
                <title>{`${name(a.id)}: ${t("map.clubs", { count })}`}</title>
                {a.paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    style={{ fill: fillFor(count, max), transition: "fill .15s" }}
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
            ? `${name(hover)}: ${t("map.clubs", { count: counts.get(hover) ?? 0 })}`
            : selected
              ? t("map.selected", { name: name(selected) })
              : t("map.legend")}
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
          <ul className="flex flex-col gap-2">
            {shown.map((c) => (
              <li key={c.clubId}>
                <Link
                  href={`/vizitka/${encodeURIComponent(c.clubId)}`}
                  className="hover:bg-muted/50 flex flex-col gap-0.5 rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium break-words">{c.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {[
                      c.place ? `${c.place.obfz} · ${c.place.rfz}` : t("list.noPlace"),
                      c.size ? t(`sizes.${c.size}`) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="text-xs">
                    {c.kompas !== null
                      ? t("list.kompas", { points: c.kompas })
                      : t("list.kompasNone")}{" "}
                    · {c.licensingClosed ? t("list.licensing") : t("list.licensingNone")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
