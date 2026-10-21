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
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: "medium" });
  if (!data.previous && data.weakest.length === 0) return null;
  return (
    <aside className="flex flex-col gap-2 rounded-xl border-l-4 border-l-amber-600 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
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
      <p className="text-muted-foreground text-xs">
        {data.weakest.length > 0
          ? t("weakest", {
              areas: data.weakest.map((w) => `${w.area} ${areaName(w.area)}`).join(" · "),
            })
          : t("noKompas")}
      </p>
    </aside>
  );
}
