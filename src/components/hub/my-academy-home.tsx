import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { academyDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getMyAcademy, splitTasks, type AcademyTask } from "@/server/services/academy.service";
import { listAreas } from "@/server/services/content.service";
import type { CurrentUser } from "@/server/services/users.service";

const SEVERITY: Record<AcademyTask["severity"], string> = {
  crit: "border-l-red-600",
  warn: "border-l-amber-500",
  info: "border-l-blue-600",
};

const isoDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });

const date = (d: Date) =>
  d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

/** Signed-in part of the home screen (H5b): Vizitka of the club, tasks and weak areas; mentor's clubs. */
export async function MyAcademyHome({ user }: { user: CurrentUser }) {
  const t = await getTranslations("hub.mine");
  const tA = await getTranslations("academy");
  const tTask = await getTranslations("academy.tasks");
  const [view, areas] = await Promise.all([
    getMyAcademy(academyDeps, user),
    listAreas(mongoContentStore, user),
  ]);
  if (view.clubs.length === 0 && !view.mentor) return null;
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const taskText = (task: AcademyTask) =>
    tTask(task.key, {
      count: task.count ?? 0,
      area: task.area ?? 0,
      points: task.points ?? 0,
      club: task.clubName ?? "",
      step: task.step ?? "",
    }) +
    (task.due?.date
      ? ` · ${tTask(task.due.overdue ? "overdue" : "dueBy", { date: isoDate(task.due.date) })}`
      : "");

  return (
    <section
      aria-labelledby="hub-mine"
      className="border-primary flex flex-col gap-4 rounded-2xl border-2 p-4"
    >
      <div>
        <h2 id="hub-mine" className="text-xl font-semibold">
          {user.name ? t("hello", { name: user.name }) : t("title")}
        </h2>
        <p className="text-muted-foreground text-sm">{tA("season", { season: view.season })}</p>
      </div>

      {view.clubs.map((club) => {
        const base = `/klub/${encodeURIComponent(club.clubId)}`;
        const { todo, more, weak, practice } = splitTasks(club.tasks);
        return (
          <div key={club.clubId} className="flex flex-col gap-4">
            <p className="font-semibold break-words">
              <Link href={base} className="hover:underline">
                {club.name}
              </Link>{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · {club.baseRoleNames.join(", ")}
              </span>
            </p>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("vizitka")}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/60 flex flex-col gap-0.5 rounded-lg p-3">
                  <span className="text-muted-foreground text-xs">{t("kompas")}</span>
                  <span className="text-lg font-semibold">
                    {club.kompas && club.kompas.filledAreas > 0
                      ? t("kompasScore", { total: club.kompas.total })
                      : t("empty")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {club.kompas?.submittedAt
                      ? tA("standing.kompasSent", { date: date(club.kompas.submittedAt) })
                      : tA("standing.kompasNotSent")}
                  </span>
                </div>
                <div className="bg-muted/60 flex flex-col gap-0.5 rounded-lg p-3">
                  <span className="text-muted-foreground text-xs">{t("licensing")}</span>
                  <span className="text-lg font-semibold">
                    {club.licensingClosedAt ? t("closed") : t("open")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {club.licensingClosedAt ? date(club.licensingClosedAt) : t("openHint")}
                  </span>
                </div>
              </div>
              <Link
                href={`${base}/vizitka`}
                className="self-start text-sm underline underline-offset-4"
              >
                {tA("standing.vizitka")} →
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("tasks")}</h3>
              {todo.length === 0 ? (
                <p className="text-muted-foreground text-sm">{tTask("none")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {todo.map((task) => (
                    <li key={task.key}>
                      <Link
                        href={task.href}
                        className={`hover:bg-muted/50 block rounded-md border border-l-4 p-3 text-sm ${SEVERITY[task.severity]}`}
                      >
                        {taskText(task)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {more > 0 && (
                <Link href="/moja-akademia" className="self-start text-xs underline">
                  {t("more", { count: more })}
                </Link>
              )}
            </div>

            {practice.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("practice")}</h3>
                <ul className="flex flex-col gap-2">
                  {practice.map((task) => (
                    <li key={`${task.key}-${task.area}`}>
                      <Link
                        href={task.href}
                        className={`hover:bg-muted/50 block rounded-md border border-l-4 p-3 text-sm ${SEVERITY[task.severity]}`}
                      >
                        {taskText(task)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {weak.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{t("weak")}</h3>
                <ul className="flex flex-col">
                  {weak.map((w) => (
                    <li key={w.area}>
                      <Link
                        href={w.href}
                        className="hover:bg-muted/50 flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-red-600 text-xs font-semibold">
                          {w.area}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{areaName(w.area!)}</span>
                        <span className="text-muted-foreground shrink-0 text-right text-xs">
                          {t("points", { points: w.points ?? 0 })}
                          {w.practice && (
                            <span className="block">
                              {tTask("practiceProgress", {
                                done: w.practice.stepsDone,
                                total: w.practice.stepsTotal,
                              })}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}

      {view.mentor && (
        <details className="flex flex-col gap-2 rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            {tA("mentor.title")}{" "}
            <span className="text-muted-foreground font-normal">
              ·{" "}
              {t("mentorSummary", {
                count: view.mentor.rows.length,
                sent: view.mentor.rows.filter((r) => r.latest).length,
              })}
            </span>
          </summary>
          <ul className="mt-2 divide-y rounded-md border">
            {view.mentor.rows.map((r) => (
              <li key={r.clubId}>
                <Link
                  href={`/klub/${encodeURIComponent(r.clubId)}/vizitka`}
                  className="hover:bg-muted/50 flex flex-col gap-0.5 px-3 py-2 text-sm"
                >
                  <span className="font-medium break-words">{r.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {r.latest
                      ? tA("mentor.latest", {
                          date: date(r.latest.submittedAt),
                          total: r.latest.total,
                          filled: r.latest.filledAreas,
                        })
                      : tA("mentor.none")}{" "}
                    ·{" "}
                    {r.licensingClosed ? tA("mentor.licensingClosed") : tA("mentor.licensingOpen")}{" "}
                    ·{" "}
                    {r.visits.lastDate
                      ? tA("mentor.visitLine", {
                          date: isoDate(r.visits.lastDate),
                          open: r.visits.open,
                        })
                      : tA("mentor.noVisit")}
                    {r.visits.overdue > 0 &&
                      ` · ${tA("mentor.overdue", { count: r.visits.overdue })}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href="/moja-akademia" className="self-start text-sm font-semibold underline">
        {t("academy")} →
      </Link>
    </section>
  );
}
