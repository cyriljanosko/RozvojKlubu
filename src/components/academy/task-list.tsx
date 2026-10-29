import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge, Card, Icon } from "@/components/sfz";
import type { AcademyTask } from "@/server/services/academy.service";

const SEVERITY_TONE = { crit: "danger", warn: "warning", info: "info" } as const;

const isoDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });

/** Tasks of a club as a grouped list on the SFZ Design System (club overview, R4 G2a). */
export async function TaskList({
  title,
  tasks,
  limit,
}: {
  title: string;
  tasks: AcademyTask[];
  limit?: number;
}) {
  const t = await getTranslations("academy.tasks");
  const shown = limit ? tasks.slice(0, limit) : tasks;
  return (
    <Card title={title} flush>
      {shown.length === 0 ? (
        <p className="callout px-4 pb-4 text-(--ink-muted)">{t("none")}</p>
      ) : (
        <ul>
          {shown.map((task, i) => (
            <li
              key={`${task.key}-${task.area ?? task.clubName ?? i}`}
              className="border-t border-(--hairline) first:border-t-0"
            >
              <Link
                href={task.href}
                className="flex min-h-14 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="callout">
                    {t(task.key, {
                      count: task.count ?? 0,
                      area: task.area ?? 0,
                      points: task.points ?? 0,
                      club: task.clubName ?? "",
                      step: task.step ?? "",
                    })}
                  </span>
                  {(task.practice || task.due?.date) && (
                    <span className="footnote text-(--ink-muted)">
                      {[
                        task.practice &&
                          t("practiceProgress", {
                            done: task.practice.stepsDone,
                            total: task.practice.stepsTotal,
                          }),
                        task.due?.date &&
                          t(task.due.overdue ? "overdue" : "dueBy", {
                            date: isoDate(task.due.date),
                          }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                {task.severity !== "info" && (
                  <Badge tone={SEVERITY_TONE[task.severity]} dot>
                    {t(`severity.${task.severity}`)}
                  </Badge>
                )}
                <span className="text-(--ink-muted)" aria-hidden>
                  <Icon name="chevron-right" size={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
