import { getFormatter, getTranslations } from "next-intl/server";

import type { VisitFormData } from "@/server/services/mentor-visit.service";

/** Reminder above the mentor's form: the last visit's open actions and the weakest areas. */
export async function VisitContext({
  data,
  areaName,
}: {
  data: VisitFormData;
  areaName: (n: number) => string;
}) {
  const t = await getTranslations("visits.context");
  const tPlan = await getTranslations("plan");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: "medium" });
  return (
    <aside className="flex flex-col gap-2 rounded-(--radius-md) border-l-4 border-l-(--warning) bg-(--warning-tint) p-4 text-sm">
      {data.previous ? (
        <>
          <p className="font-semibold">
            {t("previous", {
              date: date(data.previous.date),
              done: data.previous.done,
              total: data.previous.total,
            })}
          </p>
          {data.previous.open.length > 0 && (
            <ul className="flex flex-col gap-1">
              {data.previous.open.map((a) => (
                <li key={a.id}>
                  ○ {a.text} · {a.owner}
                  {a.dueDate && ` · ${t("due", { date: date(a.dueDate) })}`}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="font-semibold">{t("first")}</p>
      )}
      {data.planGoals.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">{t("plan")}</p>
          <ul className="flex flex-col gap-0.5">
            {data.planGoals.map((g, i) => (
              <li key={i}>
                {g.status === "done" ? "✓" : "○"} {g.area} · {g.title}{" "}
                <span className="text-(--ink-muted)">· {tPlan(`status.${g.status}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-(--ink-muted)">
        {data.weakest.length > 0
          ? t("weakest", {
              areas: data.weakest.map((w) => `${w.area} ${areaName(w.area)}`).join(" · "),
            })
          : t("noKompas")}
      </p>
    </aside>
  );
}
