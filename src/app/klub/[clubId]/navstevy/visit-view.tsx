import { getFormatter, getTranslations } from "next-intl/server";

import type { StoredVisit } from "@/server/services/mentor-visit.service";

import { ActionChecklist } from "./action-checklist";

/** Read-only visit (the club's view of a sent visit; a withdrawn visit for the mentor). */
export async function VisitView({
  visit,
  members,
  areaName,
  clubId,
  canTick,
  today,
}: {
  visit: StoredVisit;
  members: Map<string, string>;
  areaName: (n: number) => string;
  clubId: string;
  /** the club ticks agreed actions of a sent visit (MV-c) */
  canTick: boolean;
  today: string;
}) {
  const t = await getTranslations("visits");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: "long" });
  const present = [
    ...visit.participantIds.map((id) => members.get(id) ?? "—"),
    ...(visit.participants ? [visit.participants] : []),
  ];
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-muted-foreground">
        {t(`form.forms.${visit.form}`)}
        {present.length > 0 && ` · ${t("present")}: ${present.join(", ")}`}
      </p>
      {visit.summary && <p className="whitespace-pre-wrap">{visit.summary}</p>}
      {visit.findings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("form.findings")}</h2>
          <ul className="flex flex-col gap-2">
            {visit.findings.map((f) => (
              <li key={f.area} className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  {f.area} · {areaName(f.area)}
                </p>
                <p className="whitespace-pre-wrap">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {canTick && visit.status === "sent" && visit.actions.length > 0 ? (
        <ActionChecklist
          clubId={clubId}
          visitId={visit.id}
          version={visit.version}
          actions={visit.actions.map((a) => ({
            id: a.id,
            text: a.text,
            meta: [
              a.owner,
              a.area ? `${a.area} · ${areaName(a.area)}` : null,
              a.dueDate ? t("context.due", { date: date(a.dueDate) }) : null,
            ]
              .filter(Boolean)
              .join(" · "),
            overdue: a.dueDate !== null && a.dueDate < today,
            done: a.done,
            doneNote: a.doneAt
              ? t("club.doneOn", {
                  date: format.dateTime(new Date(a.doneAt), { dateStyle: "medium" }),
                })
              : null,
          }))}
        />
      ) : (
        visit.actions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">{t("form.actions")}</h2>
            <ul className="flex flex-col gap-2">
              {visit.actions.map((a) => (
                <li key={a.id} className="flex gap-2 rounded-lg border p-3">
                  <span aria-hidden>{a.done ? "✓" : "○"}</span>
                  <span className="flex flex-col">
                    <span className={a.done ? "line-through" : ""}>{a.text}</span>
                    <span className="text-muted-foreground text-xs">
                      {[
                        a.owner,
                        a.area ? `${a.area} · ${areaName(a.area)}` : null,
                        a.dueDate ? t("context.due", { date: date(a.dueDate) }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
