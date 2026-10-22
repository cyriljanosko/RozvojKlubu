import { getFormatter, getTranslations } from "next-intl/server";

import type { StoredVisit } from "@/server/services/mentor-visit.service";

import { ActionChecklist } from "./action-checklist";
import { PrepCheck } from "./prep-check";

const ASSESSMENT = ["strengths", "weaknesses", "recommendations", "overall"] as const;

/**
 * Read-only visit: the club's view of a sent or planned visit, the mentor's view of a planned or
 * withdrawn one. Topic, the task before the visit (the club ticks it), the assessment in four
 * fields (or the summary of older visits), findings and agreed steps with their ratings (MC-b).
 */
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
  const tRating = await getTranslations("visits.ratings");
  const rating = (value: string | null) =>
    value ? (
      <span className="rounded-full border px-1.5 py-0.5 text-[11px]">
        {tRating(`values.${value}`)}
      </span>
    ) : null;
  const prep = visit.prepTask;
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
      {visit.topics.length > 0 && (
        <p>
          {t("topics", {
            areas: visit.topics.map((n) => `${n} ${areaName(n)}`).join(" · "),
          })}
        </p>
      )}
      {prep && (
        <section className="flex flex-col gap-2 rounded-lg border p-3">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {t("prep.title")} {rating(prep.rating)}
          </h2>
          <p className="whitespace-pre-wrap">{prep.text}</p>
          {prep.dueDate && (
            <p className="text-muted-foreground text-xs">
              {t("prep.due", { date: date(prep.dueDate) })}
            </p>
          )}
          {visit.status === "planned" || visit.status === "sent" ? (
            <PrepCheck
              key={visit.version}
              clubId={clubId}
              visitId={visit.id}
              version={visit.version}
              done={prep.done}
            />
          ) : null}
          <p className="text-muted-foreground text-xs">
            {prep.done && prep.doneAt
              ? t("prep.done", {
                  date: format.dateTime(new Date(prep.doneAt), { dateStyle: "medium" }),
                })
              : t("prep.notDone")}
          </p>
        </section>
      )}
      {visit.assessment && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("form.assessment")}</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {ASSESSMENT.filter((k) => visit.assessment![k].trim()).map((k) => (
              <div key={k} className="rounded-lg border p-3">
                <dt className="text-muted-foreground text-xs">{t(`form.assessmentFields.${k}`)}</dt>
                <dd className="whitespace-pre-wrap">{visit.assessment![k]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
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
          key={visit.version}
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
              a.rating ? tRating(`values.${a.rating}`) : null,
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
                    <span className={a.done ? "line-through" : ""}>
                      {a.text} {rating(a.rating)}
                    </span>
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
