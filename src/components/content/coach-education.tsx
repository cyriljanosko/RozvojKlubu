import { getTranslations } from "next-intl/server";

import { Accordion, AccordionItem } from "@/components/sfz";

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
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
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
  const intro = (
    <p className="footnote text-(--ink-muted)">
      {t("intro")} <span className="sr-only">({t("external")})</span>
    </p>
  );
  const body = (
    <>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {SFZ_HUB.map((group) => (
          <div
            key={group.key}
            className="flex flex-col gap-1 rounded-(--radius-sm) bg-(--surface) p-3"
          >
            <h3 className="subheadline font-semibold">{t(`groups.${group.key}.title`)}</h3>
            {!compact && (
              <p className="footnote text-(--ink-muted)">{t(`groups.${group.key}.hint`)}</p>
            )}
            <ul className="subheadline flex flex-wrap gap-x-3 gap-y-1">
              {group.links.map((l) => (
                <li key={l.id}>
                  <External href={l.url}>{l.label}</External>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="subheadline flex flex-wrap gap-x-4 gap-y-1">
        <External href={ticketing.url} className="font-medium">
          {t("dates")}
        </External>
        <External href={coaches.url}>{t("all")}</External>
      </p>
    </>
  );

  // the dashboard tile has its own title; on the area page the block folds (decision 22. 10. 2026)
  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        {body}
      </div>
    );
  }
  return (
    <Accordion>
      <AccordionItem title={t("title")} subtitle={t("intro")}>
        <div className="flex flex-col gap-3">
          <span className="sr-only">({t("external")})</span>
          {body}
        </div>
      </AccordionItem>
    </Accordion>
  );
}
