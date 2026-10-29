import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { ClubPin } from "@/components/favorites/club-pin";
import { Card, EmptyState, Icon, LinkButton } from "@/components/sfz";
import { VizitkaView } from "@/components/vizitka/vizitka-view";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { mentoringDeps, planDeps, settingsDeps, visitDeps, vizitkaDeps } from "@/server/clubs/deps";
import { getClubSettings } from "@/server/services/club-settings.service";
import { getClubMentoring } from "@/server/services/club-mentoring.service";

import { RankingConsentToggle } from "./ranking-consent";
import { getClubPlan, summarizePlan } from "@/server/services/club-plan.service";
import { PublicPlan } from "@/components/vizitka/public-plan";
import { seasonFromSlug, seasonToSlug } from "@/server/services/season";
import { getClubVizitka } from "@/server/services/vizitka.service";
import {
  isoToday,
  listMentorVisits,
  summarizeVisits,
} from "@/server/services/mentor-visit.service";

export const metadata: Metadata = { title: defaultMessages.vizitka.title };

type Props = PageProps<"/klub/[clubId]/vizitka">;

/** Vizitka for club roles and admin_sfz (ADR 0007). */
async function ClubVizitkaPage({ params, searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const { season: slug } = await searchParams;
  const season = typeof slug === "string" ? seasonFromSlug(slug) : null;
  const t = await getTranslations("vizitka");
  const tClub = await getTranslations("club");
  let vizitka;
  try {
    vizitka = await getClubVizitka(vizitkaDeps, user, clubId, season);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <EmptyState
          title={error.code === "FORBIDDEN" ? tClub("forbidden") : t("notFound")}
          action={<LinkButton href="/moja-akademia">{tClub("back")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  const base = `/klub/${encodeURIComponent(clubId)}/vizitka`;
  const seasonQuery = `?season=${seasonToSlug(vizitka.season)}`;
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2">
        <LinkButton
          href={`/vizitka/${encodeURIComponent(clubId)}${seasonQuery}`}
          variant="secondary"
          size="sm"
        >
          {t("publicLink")}
        </LinkButton>
        <ClubPin
          user={user}
          kind="vizitka"
          clubId={clubId}
          clubName={vizitka.club.name}
          className="ml-auto"
        />
      </nav>
      <VizitkaView
        vizitka={vizitka}
        club={vizitka}
        seasonHref={(s) => `${base}?season=${seasonToSlug(s)}`}
      />
      <Card title={t("clubOnly")} flush>
        <ul>
          <PlanLine clubId={clubId} season={vizitka.season} />
          <VisitLine clubId={clubId} season={vizitka.season} />
          <MentoringLine clubId={clubId} season={vizitka.season} />
        </ul>
      </Card>
      <RankingConsent clubId={clubId} />
      <PublicPlan clubId={clubId} season={vizitka.season} />
    </div>
  );
}

/** One row of the club-only list: title, detail and a chevron. */
function Row({ href, title, detail }: { href: string; title: string; detail: ReactNode }) {
  return (
    <li className="border-t border-(--hairline) first:border-t-0">
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="headline">{title}</span>
          <span className="footnote text-(--ink-muted)">{detail}</span>
        </span>
        <span className="text-(--ink-muted)" aria-hidden>
          <Icon name="chevron-right" size={18} />
        </span>
      </Link>
    </li>
  );
}

/** The season's plan – only in the Vizitka for club roles (CP-b). */
async function PlanLine({ clubId, season }: { clubId: string; season: string }) {
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("plan.vizitka");
  let view;
  try {
    view = await getClubPlan(planDeps, user, clubId);
  } catch {
    return null; // no access to the plan
  }
  if (view.season !== season) return null;
  const s = summarizePlan(view.plan);
  return (
    <Row
      href={`/klub/${encodeURIComponent(clubId)}/plan`}
      title={t("rowTitle")}
      detail={
        <>
          {s.goals > 0 ? t("line", { done: s.done, goals: s.goals }) : t("none")}
          {s.confirmed && ` · ${t("confirmed")}`}
        </>
      }
    />
  );
}

/** Mentor visits of the season – only in the Vizitka for club roles, never public (MV-c). */
async function VisitLine({ clubId, season }: { clubId: string; season: string }) {
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("visits.vizitka");
  let list;
  try {
    list = await listMentorVisits(visitDeps, user, clubId);
  } catch {
    return null; // no access to visits (e.g. no role in the club this season)
  }
  const s = summarizeVisits(list.visits, season, isoToday());
  const date = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" });
  return (
    <Row
      href={`/klub/${encodeURIComponent(clubId)}/navstevy`}
      title={t("title")}
      detail={
        <>
          {s.lastDate ? t("line", { date: date(s.lastDate), open: s.open }) : t("none")}
          {s.overdue > 0 && (
            <span className="text-(--danger)"> · {t("overdue", { count: s.overdue })}</span>
          )}
        </>
      }
    />
  );
}

/** The season's mentoring cycle – only in the Vizitka for club roles, never public (MC-d). */
async function MentoringLine({ clubId, season }: { clubId: string; season: string }) {
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("mentoring.vizitka");
  let view;
  try {
    view = await getClubMentoring(mentoringDeps, user, clubId, season);
  } catch {
    return null; // no access to the mentoring
  }
  const done = Object.values(view.done).filter(Boolean).length;
  return (
    <Row
      href={`/klub/${encodeURIComponent(clubId)}/mentoring`}
      title={t("title")}
      detail={done > 0 ? t("line", { done }) : t("none")}
    />
  );
}

/** Consent to the public rankings (MR-c, ADR 0015, ADR 0020): management or admin_sfz decides, other roles see the state. */
async function RankingConsent({ clubId }: { clubId: string }) {
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("ranking.consent");
  let settings;
  try {
    settings = await getClubSettings(settingsDeps, user, clubId);
  } catch {
    return null; // no access to the club's settings
  }
  const consent = settings.rankingConsent;
  const date = (d: Date) =>
    d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });
  return (
    <Card id="rebricek" title={t("title")} className="scroll-mt-20">
      <div className="flex flex-col gap-3">
        <p className="callout">{t("intro")}</p>
        <p className="headline">
          {consent === null
            ? t("undecided")
            : consent.given
              ? t("given", { date: date(consent.at) })
              : t("declined", { date: date(consent.at) })}
        </p>
        {settings.canEdit ? (
          <RankingConsentToggle
            clubId={clubId}
            given={consent?.given ?? null}
            version={settings.version}
          />
        ) : (
          <p className="footnote text-(--ink-muted)">{t("managementOnly")}</p>
        )}
        <Link href="/vizitka" className="subheadline self-start">
          {t("see")}
        </Link>
      </div>
    </Card>
  );
}

export default function Page(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ClubVizitkaPage {...props} />
      </Suspense>
    </main>
  );
}
