import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { TaskList } from "@/components/academy/task-list";
import {
  Accordion,
  AccordionItem,
  Badge,
  Card,
  EmptyState,
  Icon,
  LinkButton,
  LinkChip,
} from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, clubDeps } from "@/server/clubs/deps";
import { getMyAcademy, type AcademyClub } from "@/server/services/academy.service";
import { isAdmin } from "@/server/services/club-access";
import { getClubOverview, type ClubOverview } from "@/server/services/clubs.service";
import { currentSeason, seasonFromSlug, seasonToSlug } from "@/server/services/season";
import type { CurrentUser } from "@/server/services/users.service";

export const metadata: Metadata = { title: defaultMessages.club.title };

type Props = PageProps<"/klub/[clubId]">;

async function loadOverview(
  clubId: string,
  seasonSlug: string | undefined,
): Promise<
  | (ClubOverview & { canKompas: boolean; canLicensing: boolean; user: CurrentUser })
  | "forbidden"
  | "notFound"
> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const season = seasonSlug ? (seasonFromSlug(seasonSlug) ?? undefined) : undefined;
  try {
    const overview = await getClubOverview(clubDeps, user, clubId, season);
    // Kompas: management edits, coaches read, admin_sfz both; mentors see only submitted versions (F4c)
    // Licensing evaluation: management and mentor edit, coaches read (ADR 0006)
    return {
      ...overview,
      user,
      canKompas: isAdmin(user) || overview.roles.some((r) => r !== "mentor"),
      canLicensing: isAdmin(user) || overview.roles.length > 0,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") return "forbidden";
    if (error instanceof ApiError && error.code === "NOT_FOUND") return "notFound";
    throw error;
  }
}

const isoDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });

type Tone = "neutral" | "info" | "success" | "warning";
interface Tile {
  key: string;
  href: string;
  value: string;
  state: string;
  tone: Tone;
}

/** Status tiles of the season from the user's academy view (Kompas, licensing, plan, mentoring). */
async function statusTiles(
  club: AcademyClub,
  base: string,
  can: { kompas: boolean; licensing: boolean },
): Promise<Tile[]> {
  const t = await getTranslations("club.overview.tiles");
  const tiles: Tile[] = [];
  if (can.kompas) {
    const k = club.kompas;
    tiles.push({
      key: "kompas",
      href: `${base}/kompas`,
      value: k ? t("kompasValue", { filled: k.filledAreas }) : "–",
      ...(!k || k.version === 0
        ? { state: t("kompasEmpty"), tone: "neutral" as const }
        : k.submittedAt
          ? { state: t("kompasSent"), tone: "success" as const }
          : { state: t("kompasDraft"), tone: "warning" as const }),
    });
  }
  if (!can.licensing) return tiles;
  tiles.push({
    key: "licensing",
    href: `${base}/licencne-hodnotenie`,
    value: club.licensingClosedAt
      ? t("licensingClosedOn", {
          date: club.licensingClosedAt.toLocaleDateString("sk", {
            timeZone: "Europe/Bratislava",
          }),
        })
      : t("licensingSeason"),
    ...(club.licensingClosedAt
      ? { state: t("licensingClosed"), tone: "success" as const }
      : { state: t("licensingOpen"), tone: "info" as const }),
  });
  const p = club.plan;
  tiles.push({
    key: "plan",
    href: `${base}/plan`,
    value: p.goals > 0 ? t("planValue", { done: p.done, goals: p.goals }) : t("planNone"),
    ...(p.confirmed
      ? { state: t("planConfirmed"), tone: "success" as const }
      : p.goals > 0
        ? { state: t("planDraft"), tone: "info" as const }
        : { state: t("planMissing"), tone: "warning" as const }),
  });
  const v = club.visits;
  tiles.push({
    key: "mentoring",
    href: `${base}/navstevy`,
    value: v.nextPlanned
      ? t("visitNext", { date: isoDate(v.nextPlanned) })
      : v.lastDate
        ? t("visitLast", { date: isoDate(v.lastDate) })
        : t("visitNone"),
    ...(v.overdue > 0
      ? { state: t("visitOverdue", { count: v.overdue }), tone: "warning" as const }
      : v.nextPlanned
        ? { state: t("visitPlanned"), tone: "info" as const }
        : club.mentoring
          ? { state: t("mentoringActive"), tone: "success" as const }
          : { state: t("mentoringNone"), tone: "neutral" as const }),
  });
  return tiles;
}

async function ClubDetail({ params, searchParams }: Props) {
  const { clubId: rawId } = await params;
  const { season } = await searchParams;
  const clubId = decodeURIComponent(rawId);
  const result = await loadOverview(clubId, typeof season === "string" ? season : undefined);
  const t = await getTranslations("club");
  const format = await getFormatter();

  if (result === "forbidden" || result === "notFound") {
    return (
      <EmptyState
        title={result === "forbidden" ? t("forbidden") : t("notFound")}
        action={<LinkButton href="/moja-akademia">{t("back")}</LinkButton>}
      />
    );
  }

  const { club, stats, teams } = result;
  const base = `/klub/${encodeURIComponent(club.clubId)}`;
  const href = (s: string) => `${base}?season=${seasonToSlug(s)}`;
  // the season's status and tasks come from the user's academy view (only for own clubs, current season)
  const academy =
    result.season === currentSeason()
      ? (await getMyAcademy(academyDeps, result.user)).clubs.find((c) => c.clubId === club.clubId)
      : undefined;
  const tiles = academy
    ? await statusTiles(academy, base, { kompas: result.canKompas, licensing: result.canLicensing })
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        {result.seasons.length > 1 && (
          <nav
            aria-label={t("season")}
            className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
          >
            {result.seasons.map((s) => (
              <LinkChip key={s} href={href(s)} selected={s === result.season}>
                {s}
              </LinkChip>
            ))}
          </nav>
        )}
        {tiles.length > 0 && (
          <section
            aria-label={t("overview.status", { season: result.season })}
            className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:gap-3"
          >
            {tiles.map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className="flex min-h-28 flex-col gap-1.5 rounded-(--radius-md) bg-(--surface-raised) p-3.5 text-(--ink) no-underline sm:p-4"
              >
                <span className="label text-(--ink-muted)">{t(`overview.tiles.${tile.key}`)}</span>
                <span className="headline">{tile.value}</span>
                <Badge tone={tile.tone} dot className="mt-auto self-start">
                  {tile.state}
                </Badge>
              </Link>
            ))}
          </section>
        )}
        {academy && <TaskList title={t("overview.next")} tasks={academy.tasks} limit={5} />}
        {teams.length > 0 && (
          <Accordion>
            <AccordionItem
              title={t("teams.title")}
              subtitle={t("overview.teamsCount", { count: teams.length })}
            >
              <ul className="flex flex-col">
                {teams.map((team, i) => (
                  <li
                    key={`${team.name}-${team.gender}-${i}`}
                    className="flex flex-col gap-0.5 border-t border-(--hairline) py-2.5 first:border-t-0"
                  >
                    <span className="subheadline font-semibold break-words">
                      {team.name}{" "}
                      <span className="font-normal text-(--ink-muted)">
                        ({t(`gender.${team.gender}`)})
                      </span>
                    </span>
                    <span className="footnote break-words text-(--ink-muted)">
                      {team.competitions.length > 0
                        ? team.competitions.join(", ")
                        : t("teams.noCompetition")}{" "}
                      · {t("teams.players", { count: team.playerCount })}
                    </span>
                  </li>
                ))}
              </ul>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <Card
          title={t("overview.numbers")}
          footer={
            result.dataAsOf ? (
              <span className="footnote text-(--ink-muted)">
                {t("dataAsOf", {
                  date: format.dateTime(new Date(result.dataAsOf), { dateStyle: "long" }),
                })}
              </span>
            ) : undefined
          }
        >
          {stats ? (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label={t("stats.teams")} value={stats.teams}>
                {stats.teamsInCompetition} {t("stats.teamsInCompetition")}
              </Stat>
              <Stat label={t("stats.uniquePlayers")} value={stats.uniquePlayers}>
                {stats.girls > 0 && `${t("stats.girls")} ${stats.girls}`}
              </Stat>
              <Stat label={t("stats.coaches")} value={stats.coaches} />
            </dl>
          ) : (
            <p className="callout text-(--ink-muted)">{t("noData")}</p>
          )}
        </Card>
        {(result.canKompas || result.canLicensing) && (
          <Link
            href={`${base}/vizitka?season=${seasonToSlug(result.season)}`}
            className="flex items-center gap-3 rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink) no-underline"
          >
            <span className="text-(--brand-blue-ink)" aria-hidden>
              <Icon name="trophy" size={24} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="headline">{t("overview.vizitka")}</span>
              <span className="footnote text-(--ink-muted)">
                {academy
                  ? t("overview.ranking", {
                      state:
                        academy.rankingConsent === null
                          ? "undecided"
                          : academy.rankingConsent
                            ? "yes"
                            : "no",
                    })
                  : t("overview.vizitkaHint")}
              </span>
            </span>
            <span className="text-(--ink-muted)" aria-hidden>
              <Icon name="chevron-right" size={18} />
            </span>
          </Link>
        )}
      </aside>
    </div>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dd className="title-2 order-1 tabular-nums">{value}</dd>
      <dt className="footnote order-2 text-(--ink-muted)">{label}</dt>
      {children && <dd className="caption-1 order-3 text-(--ink-muted)">{children}</dd>}
    </div>
  );
}

export default function ClubPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ClubDetail {...props} />
      </Suspense>
    </main>
  );
}
