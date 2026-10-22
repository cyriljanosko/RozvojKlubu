import { getTranslations } from "next-intl/server";

import { planDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getPublicPlan } from "@/server/services/club-plan.service";
import { listAreas } from "@/server/services/content.service";

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
    <section aria-labelledby="vizitka-plan" className="flex flex-col gap-3">
      <h2 id="vizitka-plan" className="text-lg font-semibold">
        {t("vizitka.title")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {plan.goals.map((g, i) => (
          <li key={i} className="flex flex-col gap-1 rounded-xl border p-4 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {g.area} · {areaName(g.area)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 ${g.status === "done" ? "border-green-700 text-green-700 dark:border-green-500 dark:text-green-500" : ""}`}
              >
                {t(`status.${g.status}`)}
              </span>
            </p>
            <p>{g.publicText}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
