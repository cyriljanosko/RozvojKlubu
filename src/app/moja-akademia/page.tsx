import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { GroupedBars } from "@/components/analytics/charts";
import type { BoardPanel } from "@/components/analytics/panel-board";
import { CoachEducation } from "@/components/content/coach-education";
import { FavoritesList } from "@/components/favorites/favorites-list";
import { Milestones } from "@/components/vizitka/milestones";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, analyticsDeps, preferencesDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import {
  getMyAcademy,
  type AcademyClub,
  type AcademyTask,
} from "@/server/services/academy.service";
import { getAnalytics } from "@/server/services/analytics.service";
import { listAreas } from "@/server/services/content.service";
import { getPreferences } from "@/server/services/preferences.service";
import type { CurrentUser } from "@/server/services/users.service";

import { AreaRolesForm } from "./area-roles-form";
import { DashboardBoard } from "./dashboard-board";

export const metadata: Metadata = { title: defaultMessages.academy.title };

type Props = PageProps<"/moja-akademia">;

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

async function MentorClubs({
  rows,
}: {
  rows: NonNullable<Awaited<ReturnType<typeof getMyAcademy>>["mentor"]>["rows"];
}) {
  const t = await getTranslations("academy");
  const tM = await getTranslations("academy.dashboard.mentoring");
  return (
    <ul id="mentor-clubs" className="scroll-mt-4 divide-y rounded-md border">
      {rows.map((r) => (
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
              : t("mentor.none")}
            {r.latest &&
              ` · ${r.latest.confirmedAt ? t("mentor.confirmed") : t("mentor.unconfirmed")}`}{" "}
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
          <span className="text-muted-foreground text-xs">
            {r.plan.goals > 0
              ? t("mentor.planLine", { done: r.plan.done, goals: r.plan.goals }) +
                (r.plan.confirmed
                  ? ` · ${t("mentor.planConfirmed")}`
                  : ` · ${t("mentor.planUnconfirmed")}`)
              : t("mentor.noPlan")}
          </span>
          <span className="text-muted-foreground text-xs">
            {t("mentor.mentoringLine", {
              parts: (["intro", "focus", "closingClub", "closingMentor"] as const)
                .map((k) => `${tM(k)} ${r.mentoring[k] ? "✓" : "–"}`)
                .join(" · "),
            })}
          </span>
          <span className="flex flex-wrap gap-x-3 text-xs">
            {r.latest && !r.latest.confirmedAt && (
              <Link
                href={`/klub/${encodeURIComponent(r.clubId)}/kompas/odoslane/${r.latest.id}`}
                className="font-medium underline underline-offset-4"
              >
                {t("mentor.confirm")}
              </Link>
            )}
            <Link
              href={`/klub/${encodeURIComponent(r.clubId)}/mentoring`}
              className="underline underline-offset-4"
            >
              {tM("title")}
            </Link>
            <Link
              href={`/klub/${encodeURIComponent(r.clubId)}/plan`}
              className="underline underline-offset-4"
            >
              {t("mentor.plan")}
            </Link>
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
  );
}

const link = "self-start text-sm underline underline-offset-4";

/** Kompas of the club against the anonymous average of same-size clubs (club roles only, DA-a). */
async function KompasTile({ club, user }: { club: AcademyClub; user: CurrentUser }) {
  const t = await getTranslations("academy.dashboard.kompas");
  const kompas = club.kompas;
  if (!kompas || kompas.filledAreas === 0) {
    return (
      <>
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
        <Link href={`/klub/${encodeURIComponent(club.clubId)}/kompas`} className={link}>
          {t("fill")}
        </Link>
      </>
    );
  }
  const analysis = await getAnalytics(analyticsDeps, user, { clubs: [club.clubId] }).catch(
    () => null,
  );
  const benchmark = analysis?.scope === "club" ? analysis.benchmark : null;
  return (
    <>
      <GroupedBars
        data={kompas.areas.map((points, i) => ({
          label: String(i + 1),
          own: points,
          ...(benchmark ? { benchmark: benchmark.kompas[i] } : {}),
        }))}
        series={[
          { key: "own", label: t("own") },
          ...(benchmark ? [{ key: "benchmark", label: t("similar") }] : []),
        ]}
        max={20}
        height={200}
      />
      <p className="text-muted-foreground text-xs">
        {benchmark ? t("benchmark", { count: benchmark.clubs }) : t("note")}
      </p>
    </>
  );
}

async function Academy({ searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const q = await searchParams;
  const t = await getTranslations("academy");
  const tD = await getTranslations("academy.dashboard");
  const tClubRoles = await getTranslations("clubRoles");
  const tPlan = await getTranslations("plan.status");
  const [view, areas, prefs] = await Promise.all([
    getMyAcademy(academyDeps, user),
    listAreas(mongoContentStore, user),
    getPreferences(preferencesDeps, user),
  ]);
  const areaNames = Object.fromEntries(areas.map((a) => [a.number, a.name]));
  // several clubs: the dashboard shows one, chosen above (?klub=)
  const club = view.clubs.find((c) => c.clubId === q.klub) ?? view.clubs[0] ?? null;
  const base = club ? `/klub/${encodeURIComponent(club.clubId)}` : "";

  const panels: BoardPanel[] = [
    {
      id: "favorites",
      title: t("favorites"),
      content: (
        <FavoritesList
          key={prefs.version}
          favorites={prefs.favorites.map(({ id, kind, href, label }) => ({
            id,
            kind,
            href,
            label,
          }))}
        />
      ),
    },
  ];
  if (club) {
    const weak = (club.kompas?.areas ?? [])
      .map((points, i) => ({ area: i + 1, points }))
      .filter((a): a is { area: number; points: number } => a.points !== null)
      .sort((a, b) => a.points - b.points)
      .slice(0, 3);
    const practiceTasks = club.tasks.filter((task) => task.key.startsWith("practice_"));
    panels.push(
      {
        id: "tasks",
        title: t("tasks.title"),
        content: <TaskList tasks={club.tasks} />,
      },
      {
        id: "standing",
        title: t("standing.title"),
        content: (
          <div className="flex flex-col gap-1 text-sm">
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
            <span className="flex flex-wrap gap-x-4">
              <Link href={`${base}/vizitka`} className="underline underline-offset-4">
                {t("standing.vizitka")}
              </Link>
              <Link href={`${base}/plan`} className="underline underline-offset-4">
                {t("standing.plan")}
              </Link>
            </span>
          </div>
        ),
      },
      {
        id: "kompas",
        title: tD("kompas.title"),
        content: (
          <Suspense fallback={<div className="h-52" aria-hidden />}>
            <KompasTile club={club} user={user} />
          </Suspense>
        ),
      },
      {
        id: "weak",
        title: tD("weak.title"),
        note: weak.length > 0 ? tD("weak.note") : undefined,
        content:
          weak.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tD("weak.none")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {weak.map((w) => (
                <li key={w.area} className="flex items-center justify-between gap-3">
                  <span>
                    {tD("weak.item", {
                      area: w.area,
                      name: areaNames[w.area] ?? "",
                      points: w.points,
                    })}
                  </span>
                  <Link
                    href={`/oblasti/${w.area}?tab=prax`}
                    className="shrink-0 text-xs underline underline-offset-4"
                  >
                    {tD("weak.practice")}
                  </Link>
                </li>
              ))}
            </ul>
          ),
      },
      {
        id: "plan",
        title: tD("plan.title"),
        note:
          club.plan.goals > 0
            ? tD("plan.summary", { done: club.plan.done, goals: club.plan.goals })
            : undefined,
        content: (
          <>
            {club.planGoals.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tD("plan.none")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {club.planGoals.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-3">
                    <span className={g.status === "done" ? "line-through" : ""}>
                      <span className="text-muted-foreground">{g.area} · </span>
                      {g.title}
                    </span>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs">
                      {tPlan(g.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`${base}/plan`} className={link}>
              {tD("plan.open")}
            </Link>
          </>
        ),
      },
      {
        id: "visits",
        title: tD("visits.title"),
        content: (
          <>
            <p className="text-sm">
              {club.visits.lastDate
                ? tD("visits.last", { date: isoDate(club.visits.lastDate) })
                : tD("visits.none")}
            </p>
            {club.visits.open > 0 && (
              <p className="text-sm">
                {tD("visits.open", { count: club.visits.open })}
                {club.visits.overdue > 0 && (
                  <span className="text-destructive ml-1.5 rounded-full border px-1.5 text-xs">
                    {tD("visits.overdue", { count: club.visits.overdue })}
                  </span>
                )}
              </p>
            )}
            <Link href={`${base}/navstevy`} className={link}>
              {tD("visits.list")}
            </Link>
          </>
        ),
      },
      ...(club.mentoring
        ? [
            {
              id: "mentoring",
              title: tD("mentoring.title"),
              content: (
                <>
                  <ul className="grid grid-cols-2 gap-1.5 text-sm">
                    {(["intro", "focus", "closingClub", "closingMentor"] as const).map((k) => (
                      <li key={k} className="flex items-center gap-1.5">
                        <span aria-hidden>{club.mentoring![k] ? "✓" : "○"}</span>
                        {tD(`mentoring.${k}`)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm">
                    {club.mentoring.nextPlanned
                      ? tD("mentoring.next", { date: isoDate(club.mentoring.nextPlanned) })
                      : tD("mentoring.noNext")}
                  </p>
                  <Link href={`${base}/mentoring`} className={link}>
                    {tD("mentoring.open")}
                  </Link>
                </>
              ),
            },
          ]
        : []),
      {
        // milestones of the season – the club sees them whatever its consent (MR-c, ADR 0015)
        id: "milestones",
        title: tD("milestones.title"),
        note: tD("milestones.count", { count: club.milestones.length, total: 6 }),
        content: (
          <>
            <Milestones
              reached={club.milestones}
              variant="list"
              hrefs={{
                kompas: `${base}/kompas`,
                plan: `${base}/plan`,
                goal: `${base}/plan`,
                visit: `${base}/navstevy`,
                licensing: `${base}/licencne-hodnotenie`,
              }}
            />
            <p className="text-muted-foreground text-xs">
              {club.rankingConsent === true
                ? tD("milestones.ranked")
                : club.rankingConsent === false
                  ? tD("milestones.notRanked")
                  : tD("milestones.undecided")}
            </p>
            <Link href={`${base}/vizitka#rebricek`} className={link}>
              {tD("milestones.consent")}
            </Link>
          </>
        ),
      },
      {
        id: "coach-education",
        title: tD("coachEducation"),
        content: <CoachEducation compact />,
      },
      {
        id: "practice",
        title: tD("practice.title"),
        content:
          practiceTasks.length > 0 ? (
            <TaskList tasks={practiceTasks} />
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{tD("practice.none")}</p>
              <Link href="/oblasti" className={link}>
                {tD("practice.browse")}
              </Link>
            </>
          ),
      },
      {
        id: "roles",
        title: tD("roles.title"),
        note: `${t("myRoles")}: ${(club.baseRoleNames.length > 0
          ? club.baseRoleNames
          : club.roles.map((r) => tClubRoles(r))
        ).join(", ")}`,
        content: (
          <>
            {club.roleOptions.length > 0 && (
              <AreaRolesForm
                clubId={club.clubId}
                options={club.roleOptions}
                chosen={club.chosenRoles}
                areaNames={areaNames}
              />
            )}
            <div className="bg-muted/60 flex flex-col gap-1 rounded-md p-3 text-xs">
              <span className="font-semibold">{t("sees.title")}</span>
              {club.roles.map((r) => (
                <span key={r}>{t(`sees.${r}`)}</span>
              ))}
            </div>
          </>
        ),
      },
    );
  }
  if (view.mentor) {
    panels.push(
      {
        id: "mentor-tasks",
        title: tD("mentorTasks.title"),
        content: <TaskList tasks={view.mentor.tasks} />,
      },
      {
        id: "mentor-clubs",
        title: t("mentor.title"),
        note: t("mentor.intro"),
        content: (
          <>
            <MentorClubs rows={view.mentor.rows} />
            <p className="bg-muted/60 rounded-md p-3 text-xs">{t("sees.mentor")}</p>
          </>
        ),
      },
    );
  }
  if (view.admin) {
    const noKompas = view.admin.rows.filter((r) => !r.latest);
    const overdue = view.admin.rows.filter((r) => r.visits.overdue > 0);
    const noVisit = view.admin.rows.filter((r) => !r.visits.lastDate).length;
    panels.push(
      {
        id: "admin-kompas",
        title: tD("adminKompas.title"),
        note: tD("adminKompas.note", { count: noKompas.length }),
        content:
          noKompas.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tD("adminKompas.none")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {noKompas.map((r) => (
                <li key={r.clubId} className="flex flex-col px-3 py-2">
                  <Link
                    href={`/klub/${encodeURIComponent(r.clubId)}/vizitka`}
                    className="font-medium break-words hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span className="text-muted-foreground text-xs">{r.union}</span>
                </li>
              ))}
            </ul>
          ),
      },
      {
        id: "admin-mentoring",
        title: tD("adminMentoring.title"),
        note: tD("adminMentoring.note"),
        content: (
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              {tD("adminMentoring.noIntro", {
                count: view.admin.rows.filter((r) => !r.mentoring.intro).length,
              })}
            </li>
            <li>
              {tD("adminMentoring.noFocus", {
                count: view.admin.rows.filter((r) => !r.mentoring.focus).length,
              })}
            </li>
            <li>
              {tD("adminMentoring.closed", {
                count: view.admin.rows.filter(
                  (r) => r.mentoring.closingClub && r.mentoring.closingMentor,
                ).length,
              })}
            </li>
          </ul>
        ),
      },
      {
        id: "admin-overdue",
        title: tD("adminOverdue.title"),
        note: tD("adminOverdue.note"),
        content: (
          <>
            {overdue.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tD("adminOverdue.none")}</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {overdue.map((r) => (
                  <li key={r.clubId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Link
                      href={`/klub/${encodeURIComponent(r.clubId)}/navstevy`}
                      className="font-medium break-words hover:underline"
                    >
                      {r.name}
                    </Link>
                    <span className="text-destructive shrink-0 rounded-full border px-1.5 text-xs">
                      {t("mentor.overdue", { count: r.visits.overdue })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {noVisit > 0 && (
              <p className="text-muted-foreground text-xs">
                {tD("adminOverdue.noVisit", { count: noVisit })}
              </p>
            )}
          </>
        ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {[user.name, t("season", { season: view.season })].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm">{t("intro")}</p>
        {(view.clubs.length > 0 || view.mentor) && (
          <Link
            href="/analyza"
            className="self-start text-sm font-medium underline underline-offset-4"
          >
            {t("analytics")} →
          </Link>
        )}
      </header>
      {view.clubs.length === 0 && !view.mentor && (
        <p className="text-muted-foreground rounded-md border p-3 text-sm">{t("noRoles")}</p>
      )}
      {club && (
        <div className="flex flex-col gap-2">
          {view.clubs.length > 1 ? (
            <nav aria-label={tD("club")} className="flex flex-wrap gap-2">
              {view.clubs.map((c) => (
                <Link
                  key={c.clubId}
                  href={`/moja-akademia?klub=${encodeURIComponent(c.clubId)}`}
                  aria-current={c.clubId === club.clubId ? "page" : undefined}
                  className="aria-[current]:bg-primary aria-[current]:text-primary-foreground rounded-full border px-3 py-1 text-sm"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          ) : null}
          <h2 className="text-lg font-semibold break-words">
            <Link href={base} className="hover:underline">
              {club.name}
            </Link>
            <span className="text-muted-foreground ml-2 text-xs font-normal">{club.union}</span>
          </h2>
        </div>
      )}
      {panels.length > 0 && (
        <>
          <p className="text-muted-foreground text-xs">{tD("hint")}</p>
          <DashboardBoard
            key={prefs.version}
            panels={panels}
            layout={prefs.dashboard}
            version={prefs.version}
          />
        </>
      )}
    </div>
  );
}

export default function AcademyPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Academy {...props} />
      </Suspense>
    </main>
  );
}
