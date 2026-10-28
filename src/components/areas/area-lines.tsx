import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { FORMATION, type Line } from "@/components/about/formation";
import { AreaNumber, Icon } from "@/components/sfz";

/** The lines of the "eleven" from the back, as on the approved Hub design (R2a). */
const LINE_ORDER: readonly Line[] = ["goalkeeper", "defense", "midfield", "attack"];

const LINE_OF_AREA = new Map(FORMATION.map((spot) => [spot.area, spot.line]));

export function lineOfArea(area: number): Line {
  return LINE_OF_AREA.get(area) ?? "attack";
}

export interface AreaRowData {
  number: number;
  name: string;
  /** Second line: teaser, description or the sentence for the selected role. */
  text?: string | null;
  /** null = not available yet (track in preparation). */
  href: string | null;
  note?: string;
}

/** One area in a grouped list: number in the colour of its line, name, text, chevron. */
export function AreaRow({ area }: { area: AreaRowData }) {
  const body: ReactNode = (
    <>
      <AreaNumber number={area.number} line={lineOfArea(area.number)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="headline break-words">{area.name}</span>
        {area.text && <span className="footnote text-(--ink-muted)">{area.text}</span>}
        {area.note && <span className="caption-1 text-(--ink-muted)">{area.note}</span>}
      </span>
      {area.href && (
        <span className="text-(--ink-muted)" aria-hidden>
          <Icon name="chevron-right" size={18} />
        </span>
      )}
    </>
  );
  const cls = "flex min-h-13 items-start gap-3 px-4 py-3 text-(--ink) no-underline";
  return (
    <li className="border-b border-(--hairline) last:border-b-0">
      {area.href ? (
        <Link href={area.href} className={cls}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** Areas grouped by the lines of the eleven (goalkeeper → attack), each line as a grouped list. */
export async function AreaLineList({ areas }: { areas: readonly AreaRowData[] }) {
  const t = await getTranslations("aboutPage.eleven.lines");
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {LINE_ORDER.map((line) => {
        const inLine = areas.filter((area) => lineOfArea(area.number) === line);
        if (inLine.length === 0) return null;
        return (
          <section key={line} className="flex flex-col gap-2" aria-label={t(`${line}.title`)}>
            <h3 className="label text-(--ink-muted) uppercase">{t(`${line}.title`)}</h3>
            <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
              {inLine.map((area) => (
                <AreaRow key={area.number} area={area} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
