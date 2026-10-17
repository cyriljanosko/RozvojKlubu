import Link from "next/link";
import { X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { AreaDto } from "@/server/services/content.service";

type Line = "goalkeeper" | "defense" | "midfield" | "attack";

/** 1-4-3-3 on a vertical pitch (attack at the top); x/y in % of the pitch (decision 17. 10. 2026). */
export const FORMATION: { area: number; line: Line; x: number; y: number }[] = [
  { area: 7, line: "attack", x: 17, y: 15 },
  { area: 5, line: "attack", x: 50, y: 10 },
  { area: 6, line: "attack", x: 83, y: 15 },
  { area: 2, line: "midfield", x: 20, y: 42 },
  { area: 3, line: "midfield", x: 50, y: 47 },
  { area: 4, line: "midfield", x: 80, y: 42 },
  { area: 8, line: "defense", x: 12, y: 70 },
  { area: 9, line: "defense", x: 37, y: 74 },
  { area: 10, line: "defense", x: 63, y: 74 },
  { area: 11, line: "defense", x: 88, y: 70 },
  { area: 1, line: "goalkeeper", x: 50, y: 91 },
];

const BAND: Record<number, string> = {
  1: "bg-blue-600 text-white",
  2: "bg-amber-500 text-amber-950",
  3: "bg-zinc-600 text-white",
};

/**
 * The 11 areas as a football eleven (H7). Each player opens a native popover (no JavaScript)
 * with the area's description from the managed content and a link to its detail.
 */
export async function Formation({ areas }: { areas: AreaDto[] }) {
  const t = await getTranslations("aboutPage.eleven");
  const byNumber = new Map(areas.map((a) => [a.number, a]));
  const players = FORMATION.map((p) => ({ ...p, a: byNumber.get(p.area) })).filter(
    (p): p is typeof p & { a: AreaDto } => p.a !== undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t("pitch")}
        className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-green-800/30 bg-green-600/15"
      >
        {/* pitch lines */}
        <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-green-800/30" />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-green-800/30"
        />
        <div
          aria-hidden
          className="absolute top-0 left-1/2 h-[14%] w-[44%] -translate-x-1/2 border-x border-b border-green-800/30"
        />
        <div
          aria-hidden
          className="absolute bottom-0 left-1/2 h-[14%] w-[44%] -translate-x-1/2 border-x border-t border-green-800/30"
        />

        {players.map(({ a, line, x, y }) => (
          <button
            key={a.number}
            type="button"
            popoverTarget={`area-pop-${a.number}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="group absolute flex w-[22%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold shadow-sm ring-2 ring-white transition-transform group-hover:scale-110 sm:size-10 ${BAND[a.band]}`}
            >
              {a.number}
            </span>
            <span className="bg-background/85 rounded px-1 text-center text-[11px] leading-tight font-medium sm:text-xs">
              {a.shortName}
            </span>
            <span className="sr-only">{t(`lines.${line}.title`)}</span>
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-center text-sm">{t("hint")}</p>

      {players.map(({ a, line }) => (
        <div
          key={a.number}
          id={`area-pop-${a.number}`}
          popover="auto"
          className="bg-background text-foreground m-auto w-[min(22rem,calc(100vw-2rem))] rounded-xl border p-5 shadow-xl backdrop:bg-black/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {t("position", { line: t(`lines.${line}.title`), number: a.number })}
              </p>
              <h3 className="text-lg font-semibold">{a.name}</h3>
            </div>
            <button
              type="button"
              popoverTarget={`area-pop-${a.number}`}
              popoverTargetAction="hide"
              aria-label={t("close")}
              className="hover:bg-muted -mt-1 -mr-2 rounded-md p-1.5"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-sm">{a.description}</p>
          <p className="text-muted-foreground mt-2 text-xs">{t(`lines.${line}.text`)}</p>
          <Link
            href={`/oblasti/${a.number}`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex rounded-md px-3 py-2 text-sm font-medium"
          >
            {t("detail")} →
          </Link>
        </div>
      ))}
    </div>
  );
}
