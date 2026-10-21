import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getMyAcademy, type AcademyTask } from "@/server/services/academy.service";
import { listAreas } from "@/server/services/content.service";

import { AreaRolesForm } from "./area-roles-form";

export const metadata: Metadata = { title: defaultMessages.academy.title };

const SEVERITY: Record<AcademyTask["severity"], string> = {
  crit: "border-l-red-600",
  warn: "border-l-amber-500",
  info: "border-l-blue-600",
};

const isoDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });

const date = (d: Date) =>
  d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

async function TaskList({ tasks }: { tasks: AcademyTask[] }) {
  const t = await getTranslations("academy.tasks");
  if (tasks.length === 0) return <p className="text-muted-foreground text-sm">{t("none")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task, i) => (
        <li key={`${task.key}-${task.area ?? task.clubName ?? i}`}>
          <Link
            href={task.href}
            className={`hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md border border-l-4 p-3 text-sm ${SEVERITY[task.severity]}`}
          >
            <span>
              {t(task.key, {
                count: task.count ?? 0,
                area: task.area ?? 0,
                points: task.points ?? 0,
                club: task.clubName ?? "",
                step: task.step ?? "",
              })}
              {task.practice &&
                ` · ${t("practiceProgress", { done: task.practice.stepsDone, total: task.practice.stepsTotal })}`}
              {task.due?.date &&
                ` · ${t(task.due.overdue ? "overdue" : "dueBy", { date: isoDate(task.due.date) })}`}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">{t("open")} →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Academy() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("academy");
  const tClubRoles = await getTranslations("clubRoles");
  const [view, areas] = await Promise.all([
    getMyAcademy(academyDeps, user),
    listAreas(mongoContentStore, user),
  ]);
  const areaNames = Object.fromEntries(areas.map((a) => [a.number, a.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {[user.name, t("season", { season: view.season })].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm">{t("intro")}</p>
      </header>

      {view.clubs.length === 0 && !view.mentor && (
        <p className="text-muted-foreground rounded-md border p-3 text-sm">{t("noRoles")}</p>
      )}

      {view.clubs.map((club) => {
        const base = `/klub/${encodeURIComponent(club.clubId)}`;
        return (
          <section
            key={club.clubId}
            aria-labelledby={`club-${club.clubId}`}
            className="flex flex-col gap-4 rounded-xl border p-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id={`club-${club.clubId}`} className="text-lg font-semibold break-words">
                <Link href={base} className="hover:underline">
                  {club.name}
                </Link>
              </h2>
              <p className="text-muted-foreground text-xs">
                {club.union} · {t("myRoles")}:{" "}
                {(club.baseRoleNames.length > 0
                  ? club.baseRoleNames
                  : club.roles.map((r) => tClubRoles(r))
                ).join(", ")}
              </p>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <h3 className="font-semibold">{t("standing.title")}</h3>
              <p>
                {club.kompas && club.kompas.filledAreas > 0
                  ? t("standing.kompas", {
                      total: club.kompas.total,
                      filled: club.kompas.filledAreas,
                    })
                  : t("standing.kompasEmpty")}
                {" · "}
                {club.kompas?.submittedAt
                  ? t("standing.kompasSent", { date: date(club.kompas.submittedAt) })
                  : t("standing.kompasNotSent")}
              </p>
              <p>
                {club.licensingClosedAt
                  ? t("standing.licensingClosed", { date: date(club.licensingClosedAt) })
                  : t("standing.licensingOpen")}
              </p>
              <Link href={`${base}/vizitka`} className="self-start underline underline-offset-4">
                {t("standing.vizitka")}
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("tasks.title")}</h3>
              <TaskList tasks={club.tasks} />
            </div>

            {club.roleOptions.length > 0 && (
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("roles.title")}
                  {club.chosenRoles.length > 0 && ` (${club.chosenRoles.length})`}
                </summary>
                <div className="mt-3">
                  <AreaRolesForm
                    clubId={club.clubId}
                    options={club.roleOptions}
                    chosen={club.chosenRoles}
                    areaNames={areaNames}
                  />
                </div>
              </details>
            )}

            <div className="bg-muted/60 flex flex-col gap-1 rounded-md p-3 text-xs">
              <span className="font-semibold">{t("sees.title")}</span>
              {club.roles.map((r) => (
                <span key={r}>{t(`sees.${r}`)}</span>
              ))}
            </div>
          </section>
        );
      })}

      {view.mentor && (
        <section
          id="mentor"
          aria-labelledby="mentor-title"
          className="flex flex-col gap-4 rounded-xl border p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="mentor-title" className="text-lg font-semibold">
              {t("mentor.title")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("mentor.intro")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("tasks.title")}</h3>
            <TaskList tasks={view.mentor.tasks} />
          </div>
          <ul id="mentor-clubs" className="scroll-mt-4 divide-y rounded-md border">
            {view.mentor.rows.map((r) => (
              <li key={r.clubId} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
                <Link
                  href={`/klub/${encodeURIComponent(r.clubId)}/vizitka`}
                  className="font-medium break-words hover:underline"
                >
                  {r.name}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {r.union} ·{" "}
                  {r.latest
                    ? t("mentor.latest", {
                        date: date(r.latest.submittedAt),
                        total: r.latest.total,
                        filled: r.latest.filledAreas,
                      })
                    : t("mentor.none")}{" "}
                  · {r.licensingClosed ? t("mentor.licensingClosed") : t("mentor.licensingOpen")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {r.visits.lastDate
                    ? t("mentor.visitLine", {
                        date: isoDate(r.visits.lastDate),
                        open: r.visits.open,
                      })
                    : t("mentor.noVisit")}
                  {r.visits.overdue > 0 && (
                    <span className="text-destructive ml-1.5 rounded-full border px-1.5">
                      {t("mentor.overdue", { count: r.visits.overdue })}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-x-3 text-xs">
                  <Link
                    href={`/klub/${encodeURIComponent(r.clubId)}/navstevy/nova`}
                    className="font-medium underline underline-offset-4"
                  >
                    {t("mentor.newVisit")}
                  </Link>
                  <Link
                    href={`/klub/${encodeURIComponent(r.clubId)}/navstevy`}
                    className="underline underline-offset-4"
                  >
                    {t("mentor.visits")}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <p className="bg-muted/60 rounded-md p-3 text-xs">{t("sees.mentor")}</p>
        </section>
      )}
    </div>
  );
}

export default function AcademyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Academy />
      </Suspense>
    </main>
  );
}
