import "server-only";

import { getTranslations } from "next-intl/server";

import { mongoContentStore } from "@/server/db/content.store";
import { listAreas } from "@/server/services/content.service";

import type { NewsLabels } from "./news-items";

const dateFormat = new Intl.DateTimeFormat("sk", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Bratislava",
});

/** Translated labels for news items (kinds, areas, dates) – loaded once per page. */
export async function newsLabels(): Promise<NewsLabels & { areaName: (n: number) => string }> {
  const [t, areas] = await Promise.all([
    getTranslations("news"),
    listAreas(mongoContentStore, null),
  ]);
  const names = new Map(areas.map((a) => [a.number, a.shortName || a.name]));
  const areaName = (n: number) => names.get(n) ?? String(n);
  return {
    kind: { story: t("kind.story"), tip: t("kind.tip"), academy: t("kind.academy") },
    sfz: t("sfz"),
    area: (n) => t("areaBadge", { number: n, name: areaName(n) }),
    date: (iso) => (iso ? dateFormat.format(new Date(iso)) : ""),
    areaName,
  };
}
