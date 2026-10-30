// eslint-disable-next-line no-restricted-imports -- area icons until the design system has them (Cyril 30. 10. 2026)
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Coins,
  GraduationCap,
  HandHeart,
  Megaphone,
  Scale,
  ShieldCheck,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AREA_LINE_CLASS, Icon, LinkButton } from "@/components/sfz";
import type { AreaDto } from "@/server/services/content.service";

import { PITCH_TALL, PITCH_WIDE, project, toPolygon, type PitchGeometry } from "./pitch";

export type Line = "goalkeeper" | "defense" | "midfield" | "attack";

/**
 * 1-4-3-3 seen from behind the goalkeeper (attack at the far end); x/y in % of the flat pitch.
 * Decisions 17.–18. 10. 2026: icons instead of numbers, players pulled towards the centre.
 */
export const FORMATION: { area: number; line: Line; x: number; y: number }[] = [
  { area: 7, line: "attack", x: 24, y: 21 },
  { area: 5, line: "attack", x: 50, y: 17 },
  { area: 6, line: "attack", x: 76, y: 21 },
  { area: 2, line: "midfield", x: 26, y: 46 },
  { area: 3, line: "midfield", x: 50, y: 50 },
  { area: 4, line: "midfield", x: 74, y: 46 },
  { area: 8, line: "defense", x: 19, y: 69 },
  { area: 9, line: "defense", x: 40, y: 72 },
  { area: 10, line: "defense", x: 60, y: 72 },
  { area: 11, line: "defense", x: 81, y: 69 },
  { area: 1, line: "goalkeeper", x: 50, y: 87 },
];

/** Line colours (pin, popover icon, legend): the SFZ blue scale, as everywhere in the app (26. 10.). */
export const LINE_COLOR: Record<Line, string> = AREA_LINE_CLASS;

/* eslint-disable no-restricted-syntax -- the pitch is an illustration and keeps its grass green (Cyril 30. 10. 2026) */
const GRASS = { light: "#4a9e38", dark: "#3b8c2e", edge: "#2e6b24", line: "#ffffff" };
/* eslint-enable no-restricted-syntax */

/** Icon of each area; area 1 (Vedenie klubu) wears the captain's armband instead. */
const ICON: Record<number, LucideIcon> = {
  2: ClipboardList,
  3: GraduationCap,
  4: HandHeart,
  5: Shirt,
  6: CalendarDays,
  7: Megaphone,
  8: Coins,
  9: Scale,
  10: ChartColumn,
  11: ShieldCheck,
};

function AreaIcon({ area, className }: { area: number; className: string }) {
  const Icon = ICON[area];
  if (!Icon) {
    // captain's armband
    return (
      <span
        aria-hidden
        className="rounded border-2 border-current px-1 text-xs leading-none font-bold sm:text-sm"
      >
        C
      </span>
    );
  }
  return <Icon aria-hidden className={className} />;
}

/** Striped grass, lines and the pitch edge in perspective (SVG in the geometry's box). */
function PitchDrawing({ g }: { g: PitchGeometry }) {
  const line = { stroke: GRASS.line, strokeWidth: 2, fill: "none", opacity: 0.85 };
  const poly = (points: [number, number][]) => toPolygon(g, points);
  const centre = project(g, 50, 50);
  const rx = (project(g, 100, 50)[0] - project(g, 0, 50)[0]) * 0.11;
  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} aria-hidden className="absolute inset-0 size-full">
      {Array.from({ length: 10 }, (_, i) => (
        <polygon
          key={i}
          points={poly([
            [0, i * 10],
            [100, i * 10],
            [100, i * 10 + 10],
            [0, i * 10 + 10],
          ])}
          fill={i % 2 ? GRASS.dark : GRASS.light}
        />
      ))}
      <polygon
        points={`${poly([
          [0, 100],
          [100, 100],
        ])} ${g.nearRight},${g.height - 4} ${g.nearLeft},${g.height - 4}`}
        fill={GRASS.edge}
      />
      <polygon
        points={poly([
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ])}
        {...line}
      />
      <polyline
        points={poly([
          [0, 50],
          [100, 50],
        ])}
        {...line}
      />
      <ellipse cx={centre[0]} cy={centre[1]} rx={rx} ry={rx * 0.6} {...line} />
      {[
        [28, 15, 72, 0],
        [40, 6, 60, 0],
        [28, 85, 72, 100],
        [40, 94, 60, 100],
      ].map(([x1, y1, x2, y2]) => (
        <polyline
          key={`${x1}-${y1}`}
          points={poly([
            [x1, y2],
            [x1, y1],
            [x2, y1],
            [x2, y2],
          ])}
          {...line}
        />
      ))}
    </svg>
  );
}

type Player = (typeof FORMATION)[number] & { a: AreaDto };

/** The pitch with the players for one geometry (wide on larger screens, tall on phones). */
function Board({
  g,
  players,
  label,
  lineTitle,
  className,
}: {
  g: PitchGeometry;
  players: Player[];
  label: string;
  lineTitle: (line: Line) => string;
  className: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: `${g.width} / ${g.height}` }}
    >
      <PitchDrawing g={g} />
      {players.map(({ a, line, x, y }) => {
        const [px, py] = project(g, x, y);
        // farther players are a bit smaller – depth
        const scale = 0.82 + (0.22 * y) / 100;
        return (
          <button
            key={a.number}
            type="button"
            popoverTarget={`area-pop-${a.number}`}
            style={{ left: `${(px / g.width) * 100}%`, top: `${(py / g.height) * 100}%`, scale }}
            className="group absolute flex origin-[50%_calc(var(--pin)+6px)] -translate-x-1/2 -translate-y-[calc(var(--pin)+6px)] flex-col items-center"
          >
            <span
              className={`flex size-[var(--pin)] items-center justify-center rounded-(--radius-md) ring-2 ring-(--surface) transition-transform group-hover:-translate-y-0.5 ${LINE_COLOR[line]}`}
            >
              <AreaIcon area={a.number} className="size-4 sm:size-6" />
            </span>
            <span aria-hidden className={`-mt-1.5 size-2.5 rotate-45 ${LINE_COLOR[line]}`} />
            <span className="mt-1 max-w-[5rem] rounded-(--radius-sm) bg-(--surface) px-1 text-center text-[10px] leading-tight font-medium text-(--ink) sm:max-w-32 sm:text-xs">
              {a.shortName}
            </span>
            <span className="sr-only">{lineTitle(line)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The 11 areas as a football eleven (H7) on a pitch in perspective. Each player opens a native
 * popover (no JavaScript) with the area's description from the managed content and a link.
 */
export async function Formation({ areas }: { areas: AreaDto[] }) {
  const t = await getTranslations("aboutPage.eleven");
  const byNumber = new Map(areas.map((a) => [a.number, a]));
  const players = FORMATION.map((p) => ({ ...p, a: byNumber.get(p.area) })).filter(
    (p): p is Player => p.a !== undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="[--pin:2rem] sm:[--pin:2.75rem]">
        <Board
          g={PITCH_TALL}
          players={players}
          label={t("pitch")}
          lineTitle={(line) => t(`lines.${line}.title`)}
          className="mx-auto max-w-sm sm:hidden"
        />
        <Board
          g={PITCH_WIDE}
          players={players}
          label={t("pitch")}
          lineTitle={(line) => t(`lines.${line}.title`)}
          className="hidden sm:block"
        />
      </div>
      <p className="footnote text-center text-(--ink-muted)">{t("hint")}</p>

      {players.map(({ a, line }) => (
        <div
          key={a.number}
          id={`area-pop-${a.number}`}
          popover="auto"
          className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-(--radius-lg) border border-(--hairline) bg-(--surface) p-5 text-(--ink) backdrop:bg-(--overlay)"
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-(--radius-sm) ${LINE_COLOR[line]}`}
            >
              <AreaIcon area={a.number} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="footnote text-(--ink-muted)">{t(`lines.${line}.title`)}</p>
              <h3 className="title-3 break-words">{a.name}</h3>
            </div>
            <button
              type="button"
              popoverTarget={`area-pop-${a.number}`}
              popoverTargetAction="hide"
              aria-label={t("close")}
              className="sfz-btn sfz-btn--icon sfz-btn--tertiary sfz-btn--sm -mt-1 -mr-2"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <p className="callout mt-3">{a.description}</p>
          <p className="footnote mt-2 text-(--ink-muted)">{t(`lines.${line}.text`)}</p>
          <div className="mt-4">
            <LinkButton href={`/oblasti/${a.number}`} size="sm" icon="chevron-right">
              {t("detail")}
            </LinkButton>
          </div>
        </div>
      ))}
    </div>
  );
}
