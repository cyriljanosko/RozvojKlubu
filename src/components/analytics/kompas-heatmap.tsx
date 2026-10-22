import { getTranslations } from "next-intl/server";

import type { ClubAnalytics } from "@/server/services/analytics.service";

/** Colour of an area score by Kompas band (0–4, 5–8, 9–12, 13–16, 17–20). */
function bandClass(points: number | null): string {
  if (points === null) return "bg-muted text-muted-foreground";
  if (points <= 4) return "bg-red-200 text-red-950 dark:bg-red-900/60 dark:text-red-100";
  if (points <= 8) return "bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100";
  if (points <= 12)
    return "bg-yellow-100 text-yellow-950 dark:bg-yellow-900/50 dark:text-yellow-100";
  if (points <= 16) return "bg-green-200 text-green-950 dark:bg-green-900/60 dark:text-green-100";
  return "bg-green-600 text-white";
}

/** Kompas as a map clubs × areas (admin, mentor): weak spots show at a glance (DA-b). */
export async function KompasHeatmap({
  clubs,
  average,
}: {
  clubs: Pick<ClubAnalytics, "clubId" | "name" | "kompas">[];
  average: (number | null)[] | null;
}) {
  const t = await getTranslations("analytics.kompas");
  const rows = [
    ...clubs.map((c) => ({ key: c.clubId, name: c.name, areas: c.kompas.areas, avg: false })),
    ...(average ? [{ key: "avg", name: t("average"), areas: average, avg: true }] : []),
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="text-muted-foreground w-32 text-left font-medium">{t("club")}</th>
            {Array.from({ length: 11 }, (_, i) => (
              <th key={i} className="text-muted-foreground font-medium">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th
                scope="row"
                className={`max-w-32 truncate pr-1 text-left font-normal ${r.avg ? "font-semibold" : ""}`}
                title={r.name}
              >
                {r.name}
              </th>
              {r.areas.map((p, i) => (
                <td
                  key={i}
                  className={`rounded px-1 py-1 text-center tabular-nums ${bandClass(p)}`}
                  title={t("cell", { area: i + 1, points: p ?? "–" })}
                >
                  {p ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-2 text-xs">{t("legend")}</p>
    </div>
  );
}
