import Link from "next/link";
import {
  BadgeCheck,
  ClipboardList,
  Compass,
  FileCheck2,
  Flag,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { MILESTONES, type Milestone } from "@/lib/rankings";

const ICON: Record<Milestone, LucideIcon> = {
  kompas: Compass,
  confirmed: BadgeCheck,
  plan: ClipboardList,
  goal: Flag,
  visit: Handshake,
  licensing: FileCheck2,
};

/**
 * Milestones of the season (MR-c, ADR 0015). `compact`: six icons and "4/6" – reached ones in
 * colour, the rest muted, names for screen readers and on hover. `list`: icon and name of each,
 * on a phone too; with `hrefs` a missing milestone links to where the club gets it. `legend`:
 * the names in colour, to explain the icons.
 */
export function Milestones({
  reached,
  variant = "compact",
  hrefs,
}: {
  reached: readonly Milestone[];
  /** legend: every milestone in colour, without "reached / missing" */
  variant?: "compact" | "list" | "legend";
  hrefs?: Partial<Record<Milestone, string>>;
}) {
  const t = useTranslations("milestones");
  const has = new Set(reached);
  if (variant === "compact") {
    return (
      <span
        className="inline-flex items-center gap-1"
        role="img"
        aria-label={t("summary", {
          count: has.size,
          total: MILESTONES.length,
          names: MILESTONES.filter((m) => has.has(m))
            .map((m) => t(`names.${m}`))
            .join(", "),
        })}
      >
        {MILESTONES.map((m) => {
          const Icon = ICON[m];
          return (
            <span key={m} title={t(`names.${m}`)} aria-hidden>
              <Icon
                className={`size-4 ${has.has(m) ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/40"}`}
              />
            </span>
          );
        })}
        <span className="text-muted-foreground ml-0.5 text-xs tabular-nums" aria-hidden>
          {has.size}/{MILESTONES.length}
        </span>
      </span>
    );
  }
  return (
    <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
      {MILESTONES.map((m) => {
        const Icon = ICON[m];
        const done = variant === "legend" || has.has(m);
        const href = !done ? hrefs?.[m] : undefined;
        return (
          <li key={m} className="flex items-center gap-2">
            <Icon
              aria-hidden
              className={`size-4 shrink-0 ${done ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/50"}`}
            />
            <span className={done ? "" : "text-muted-foreground"}>
              {t(`names.${m}`)}
              {variant === "list" && (
                <span className="sr-only"> – {done ? t("done") : t("missing")}</span>
              )}
            </span>
            {href && (
              <Link href={href} className="ml-auto shrink-0 text-xs underline underline-offset-4">
                {t("how")}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "Potvrdené mentorom" next to the Kompas (ADR 0015). */
export function ConfirmedBadge() {
  const t = useTranslations("milestones");
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <BadgeCheck aria-hidden className="size-3.5" />
      {t("confirmed")}
    </span>
  );
}
