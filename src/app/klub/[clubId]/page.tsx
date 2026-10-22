import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { isAdmin } from "@/server/services/club-access";
import { getClubOverview, type ClubOverview } from "@/server/services/clubs.service";
import { seasonFromSlug, seasonToSlug } from "@/server/services/season";

export const metadata: Metadata = { title: defaultMessages.club.title };

type Props = PageProps<"/klub/[clubId]">;

async function loadOverview(
  clubId: string,
  seasonSlug: string | undefined,
): Promise<
  (ClubOverview & { canKompas: boolean; canLicensing: boolean }) | "forbidden" | "notFound"
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
      canKompas: isAdmin(user) || overview.roles.some((r) => r !== "mentor"),
      canLicensing: isAdmin(user) || overview.roles.length > 0,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") return "forbidden";
    if (error instanceof ApiError && error.code === "NOT_FOUND") return "notFound";
    throw error;
  }
}

async function ClubDetail({ params, searchParams }: Props) {
  const { clubId: rawId } = await params;
  const { season } = await searchParams;
  const clubId = decodeURIComponent(rawId);
  const result = await loadOverview(clubId, typeof season === "string" ? season : undefined);
  const t = await getTranslations("club");
  const tClubRoles = await getTranslations("clubRoles");
  const format = await getFormatter();
  const tKompas = await getTranslations("kompas");
  const tLicensing = await getTranslations("licensing");
  const tVizitka = await getTranslations("vizitka");
  const tVisits = await getTranslations("visits");
  const tPlan = await getTranslations("plan");

  if (result === "forbidden" || result === "notFound") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p>{result === "forbidden" ? t("forbidden") : t("notFound")}</p>
          <Link href="/ucet" className="font-medium underline underline-offset-4">
            {t("back")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { club, stats, teams } = result;
  const href = (s: string) => `/klub/${encodeURIComponent(club.clubId)}?season=${seasonToSlug(s)}`;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl break-words">{club.name}</CardTitle>
          <CardDescription>
            {t("union")}: {club.union} · {t("region")}: {club.region}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {(result.canKompas || result.canLicensing) && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/klub/${encodeURIComponent(club.clubId)}/vizitka?season=${seasonToSlug(result.season)}`}
                className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
              >
                {tVizitka("open")}
              </Link>
              {result.canKompas && (
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/kompas`}
                  className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
                >
                  {tKompas("open")}
                </Link>
              )}
              {result.canLicensing && (
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/licencne-hodnotenie?season=${seasonToSlug(result.season)}`}
                  className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
                >
                  {tLicensing("open")}
                </Link>
              )}
              {result.canLicensing && (
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/navstevy`}
                  className="rounded-md border px-3 py-2 text-sm font-medium"
                >
                  {tVisits("open")}
                </Link>
              )}
              {result.canLicensing && (
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/plan`}
                  className="rounded-md border px-3 py-2 text-sm font-medium"
                >
                  {tPlan("open")}
                </Link>
              )}
              {result.canLicensing && (
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/mentoring`}
                  className="rounded-md border px-3 py-2 text-sm font-medium"
                >
                  {t("mentoring")}
                </Link>
              )}
            </div>
          )}
          {result.roles.length > 0 && (
            <p>
              <span className="text-muted-foreground">{t("myRoles")}: </span>
              {result.roles.map((r) => tClubRoles(r)).join(", ")}
            </p>
          )}
          {result.seasons.length > 0 && (
            <nav aria-label={t("season")} className="flex flex-wrap gap-2">
              {result.seasons.map((s) => (
                <Link
                  key={s}
                  href={href(s)}
                  aria-current={s === result.season ? "page" : undefined}
                  className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground rounded-md border px-3 py-1.5"
                >
                  {s}
                </Link>
              ))}
            </nav>
          )}
          {stats ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t("stats.teams")} value={stats.teams}>
                {stats.teamsInCompetition} {t("stats.teamsInCompetition")}
              </Stat>
              <Stat label={t("stats.uniquePlayers")} value={stats.uniquePlayers}>
                {stats.girls > 0 && `${t("stats.girls")} ${stats.girls}`}
              </Stat>
              <Stat label={t("stats.coaches")} value={stats.coaches} />
            </dl>
          ) : (
            <p className="text-muted-foreground">{t("noData")}</p>
          )}
          {result.dataAsOf && (
            <p className="text-muted-foreground text-xs">
              {t("dataAsOf", {
                date: format.dateTime(new Date(result.dataAsOf), { dateStyle: "long" }),
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("teams.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {teams.map((team, i) => (
                <li
                  key={`${team.name}-${team.gender}-${i}`}
                  className="flex flex-col gap-0.5 py-2.5"
                >
                  <span className="font-medium break-words">
                    {team.name}{" "}
                    <span className="text-muted-foreground">({t(`gender.${team.gender}`)})</span>
                  </span>
                  <span className="text-muted-foreground text-xs break-words">
                    {team.competitions.length > 0
                      ? team.competitions.join(", ")
                      : t("teams.noCompetition")}{" "}
                    · {t("teams.players", { count: team.playerCount })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Link href="/ucet" className="text-sm font-medium underline underline-offset-4">
        {t("back")}
      </Link>
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
    <div className="rounded-md border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {children && <dd className="text-muted-foreground text-xs">{children}</dd>}
    </div>
  );
}

export default function ClubPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ClubDetail {...props} />
      </Suspense>
    </main>
  );
}
