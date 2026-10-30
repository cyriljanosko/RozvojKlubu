import { getTranslations } from "next-intl/server";

import type { ClubAnalytics } from "@/server/services/analytics.service";

/** Colour of an area score by Kompas band (0–4, 5–8, 9–12, 13–16, 17–20), from the status tokens. */
function bandClass(points: number | null): string {
  if (points === null) return "bg-(--surface) text-(--ink-muted)";
  if (points <= 4) return "bg-(--danger-tint) text-(--danger-ink)";
  if (points <= 8) return "bg-(--warning-tint) text-(--warning-ink)";
  if (points <= 12) return "bg-(--surface) text-(--ink) shadow-[inset_0_0_0_1px_var(--hairline)]";
  if (points <= 16) return "bg-(--info-tint) text-(--info-ink)";
  return "bg-(--success-tint) text-(--success-ink)";
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
            <th className="w-32 text-left font-medium text-(--ink-muted)">{t("club")}</th>
            {Array.from({ length: 11 }, (_, i) => (
              <th key={i} className="font-medium text-(--ink-muted)">
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
                  className={`rounded-(--radius-sm) px-1 py-1.5 text-center font-semibold tabular-nums ${bandClass(p)}`}
                  title={t("cell", { area: i + 1, points: p ?? "–" })}
                >
                  {p ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-(--ink-muted)">{t("legend")}</p>
    </div>
  );
}
