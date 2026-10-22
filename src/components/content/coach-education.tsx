import { getTranslations } from "next-intl/server";

import { SFZ_HUB, SFZ_LINKS } from "@/lib/sfz-links";

const ticketing = SFZ_LINKS.find((l) => l.id === "ticketing")!;
const coaches = SFZ_LINKS.find((l) => l.id === "coach-section")!;

function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline underline-offset-4 ${className}`}
    >
      {children}
      <span aria-hidden> ↗</span>
    </a>
  );
}

/**
 * "Vzdelávanie trénera" (decision 22. 10. 2026): a quick way to the SFZ pages a coach needs –
 * first licence, higher licences, renewal, sign-up and contacts. Links only; course dates stay
 * on SFZ Ticketing (no public API to read them from).
 */
export async function CoachEducation({ compact = false }: { compact?: boolean }) {
  const t = await getTranslations("coachEducation");
  return (
    <section
      aria-labelledby={compact ? undefined : "coach-education"}
      className={compact ? "flex flex-col gap-3" : "flex flex-col gap-3 rounded-xl border p-4"}
    >
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="coach-education" className="font-semibold">
            {t("title")}
          </h2>
          <External href={coaches.url} className="text-xs">
            futbalsfz.sk
          </External>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        {t("intro")} <span className="sr-only">({t("external")})</span>
      </p>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {SFZ_HUB.map((group) => (
          <div key={group.key} className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
            <h3 className="font-medium">{t(`groups.${group.key}.title`)}</h3>
            {!compact && (
              <p className="text-muted-foreground text-xs">{t(`groups.${group.key}.hint`)}</p>
            )}
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {group.links.map((l) => (
                <li key={l.id}>
                  <External href={l.url}>{l.label}</External>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <External href={ticketing.url} className="font-medium">
          {t("dates")}
        </External>
        <External href={coaches.url}>{t("all")}</External>
      </p>
    </section>
  );
}
