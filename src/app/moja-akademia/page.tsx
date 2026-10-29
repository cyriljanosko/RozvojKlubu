import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { GroupedBars } from "@/components/analytics/charts";
import type { BoardPanel } from "@/components/analytics/panel-board";
import { TaskList } from "@/components/academy/task-list";
import { CoachEducation } from "@/components/content/coach-education";
import { FavoritesList } from "@/components/favorites/favorites-list";
import { Badge, Card, EmptyState, Icon, LinkButton, LinkChip } from "@/components/sfz";
import { Milestones } from "@/components/vizitka/milestones";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, analyticsDeps, preferencesDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getMyAcademy, type AcademyClub } from "@/server/services/academy.service";
import { getAnalytics } from "@/server/services/analytics.service";
import { listAreas } from "@/server/services/content.service";
import { getPreferences } from "@/server/services/preferences.service";
import type { CurrentUser } from "@/server/services/users.service";

import { AreaRolesForm } from "./area-roles-form";
import { DashboardBoard } from "./dashboard-board";

export const metadata: Metadata = { title: defaultMessages.academy.title };

type Props = PageProps<"/moja-akademia">;

const SEVERITY_ORDER = { crit: 0, warn: 1, info: 2 } as const;
const PLAN_TONE = { todo: "neutral", doing: "warning", done: "success" } as const;

const isoDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });

const date = (d: Date) =>
  d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

const link = "subheadline self-start";

/** Kompas of the club against the anonymous average of same-size clubs (club roles only, DA-a). */
async function KompasTile({ club, user }: { club: AcademyClub; user: CurrentUser }) {
  const t = await getTranslations("academy.dashboard.kompas");
  const kompas = club.kompas;
  if (!kompas || kompas.filledAreas === 0) {
    return (
      <>
        <p className="text-sm text-(--ink-muted)">{t("empty")}</p>
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
      <p className="text-xs text-(--ink-muted)">
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
  const tTasks = await getTranslations("academy.tasks");
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
            <p className="text-sm text-(--ink-muted)">{tD("weak.none")}</p>
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
              <p className="text-sm text-(--ink-muted)">{tD("plan.none")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {club.planGoals.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-3">
                    <span className="subheadline">
                      <span className="text-(--ink-muted)">{g.area} · </span>
                      {g.title}
                    </span>
                    <Badge tone={PLAN_TONE[g.status]} className="shrink-0">
                      {tPlan(g.status)}
                    </Badge>
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
                  <Badge tone="danger" className="ml-1.5">
                    {tD("visits.overdue", { count: club.visits.overdue })}
                  </Badge>
                )}
              </p>
            )}
            <Link href={`${base}/mentoring#navstevy`} className={link}>
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
                visit: `${base}/mentoring#navstevy`,
                licensing: `${base}/licencne-hodnotenie`,
              }}
            />
            <p className="text-xs text-(--ink-muted)">
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
              <p className="text-sm text-(--ink-muted)">{tD("practice.none")}</p>
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
            <div className="flex flex-col gap-1 rounded-(--radius-sm) bg-(--surface) p-3 text-xs">
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
            <p className="text-sm text-(--ink-muted)">{tD("adminKompas.none")}</p>
          ) : (
            <ul className="overflow-hidden rounded-(--radius-sm) border border-(--hairline) text-sm">
              {noKompas.map((r) => (
                <li key={r.clubId} className="flex flex-col px-3 py-2">
                  <Link
                    href={`/klub/${encodeURIComponent(r.clubId)}/vizitka`}
                    className="font-medium break-words"
                  >
                    {r.name}
                  </Link>
                  <span className="text-xs text-(--ink-muted)">{r.union}</span>
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
              <p className="text-sm text-(--ink-muted)">{tD("adminOverdue.none")}</p>
            ) : (
              <ul className="overflow-hidden rounded-(--radius-sm) border border-(--hairline) text-sm">
                {overdue.map((r) => (
                  <li key={r.clubId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Link
                      href={`/klub/${encodeURIComponent(r.clubId)}/navstevy`}
                      className="font-medium break-words"
                    >
                      {r.name}
                    </Link>
                    <Badge tone="danger" className="shrink-0">
                      {t("mentor.overdue", { count: r.visits.overdue })}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {noVisit > 0 && (
              <p className="text-xs text-(--ink-muted)">
                {tD("adminOverdue.noVisit", { count: noVisit })}
              </p>
            )}
          </>
        ),
      },
    );
  }

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";
  const tasks = [...(club?.tasks ?? []), ...(view.mentor?.tasks ?? [])].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const [next, ...rest] = tasks;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="subheadline text-(--ink-muted)">{t("season", { season: view.season })}</p>
        <h1 className="large-title break-words">
          {firstName ? t("greeting", { name: firstName }) : t("title")}
        </h1>
        {view.clubs.length > 1 && club && (
          <nav
            aria-label={tD("club")}
            className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
          >
            {view.clubs.map((c) => (
              <LinkChip
                key={c.clubId}
                href={`/moja-akademia?klub=${encodeURIComponent(c.clubId)}`}
                selected={c.clubId === club.clubId}
              >
                {[c.name, ...c.roles.map((r) => tClubRoles(r))].join(" · ")}
              </LinkChip>
            ))}
          </nav>
        )}
        {club && view.clubs.length === 1 && (
          <Link href={base} className="subheadline self-start">
            {club.name} · {club.roles.map((r) => tClubRoles(r)).join(", ")}
          </Link>
        )}
      </header>

      {view.clubs.length === 0 && !view.mentor && (
        <EmptyState title={t("noRolesTitle")} description={t("noRoles")} />
      )}

      {next && (
        <Card variant="highlight" title={t("nextStep")}>
          <div className="flex flex-col gap-3">
            <p className="callout">
              {tTasks(next.key, {
                count: next.count ?? 0,
                area: next.area ?? 0,
                points: next.points ?? 0,
                club: next.clubName ?? "",
                step: next.step ?? "",
              })}
            </p>
            <LinkButton href={next.href} block>
              {t("nextStepGo")}
            </LinkButton>
          </div>
        </Card>
      )}

      {(club || view.mentor) && <TaskList title={t("tasks.title")} tasks={rest} />}

      {view.mentor && (
        <Link
          href="/mentor"
          className="flex items-center gap-3 rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink) no-underline"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="headline">{t("mentorDesk")}</span>
            <span className="footnote text-(--ink-muted)">{t("mentor.intro")}</span>
          </span>
          <span className="text-(--ink-muted)" aria-hidden>
            <Icon name="chevron-right" size={18} />
          </span>
        </Link>
      )}

      {panels.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="board-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="board-title" className="title-3">
              {t("boardTitle")}
            </h2>
            {(view.clubs.length > 0 || view.mentor) && (
              <Link href="/analyza" className="subheadline">
                {t("analytics")}
              </Link>
            )}
          </div>
          <p className="footnote text-(--ink-muted)">{tD("hint")}</p>
          <DashboardBoard
            key={prefs.version}
            panels={panels}
            layout={prefs.dashboard}
            version={prefs.version}
          />
        </section>
      )}
    </div>
  );
}

export default function AcademyPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Academy {...props} />
      </Suspense>
    </main>
  );
}
