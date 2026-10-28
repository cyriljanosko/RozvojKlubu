import { getTranslations } from "next-intl/server";

import { Badge, Card } from "@/components/sfz";
import { planDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getPublicPlan } from "@/server/services/club-plan.service";
import { listAreas } from "@/server/services/content.service";

const STATUS_TONE = { todo: "neutral", doing: "info", done: "success" } as const;

/** "What the club works on this season" – area, public sentence and status, never names (CP-b). */
export async function PublicPlan({ clubId, season }: { clubId: string; season: string }) {
  const t = await getTranslations("plan");
  const [plan, areas] = await Promise.all([
    getPublicPlan(planDeps, clubId, season),
    listAreas(mongoContentStore, null),
  ]);
  if (plan.goals.length === 0) return null;
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  return (
    <Card title={t("vizitka.title")}>
      <ul className="flex flex-col gap-3">
        {plan.goals.map((g, i) => (
          <li key={i} className="flex items-start gap-3">
            <Badge tone={STATUS_TONE[g.status]} className="shrink-0">
              {t(`status.${g.status}`)}
            </Badge>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="callout">{g.publicText}</span>
              <span className="footnote text-(--ink-muted)">
                {g.area} · {areaName(g.area)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
