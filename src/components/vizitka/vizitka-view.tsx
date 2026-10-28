import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  Avatar,
  Badge,
  Card,
  KompasBandBadge,
  LicensingBandPill,
  LinkChip,
} from "@/components/sfz";
import { ConfirmedBadge } from "@/components/vizitka/milestones";
import type { ClubVizitka, PublicVizitka } from "@/server/services/vizitka.service";

/** Shared Vizitka layout on the SFZ Design System (R4 G1d): profile, Kompas and licensing (ADR 0007). */

const num = (n: number) => n.toLocaleString("sk", { maximumFractionDigits: 1 });
const date = (d: Date) =>
  d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

export async function VizitkaView({
  vizitka,
  seasonHref,
  club,
}: {
  vizitka: PublicVizitka;
  seasonHref: (season: string) => string;
  /** present for club roles: dates, coefficient, drafts and links */
  club?: ClubVizitka;
}) {
  const t = await getTranslations("vizitka");
  const tKompasBands = await getTranslations("kompas.bands");
  const tLicensing = await getTranslations("licensing");
  const base = `/klub/${encodeURIComponent(vizitka.club.clubId)}`;
  const seasonSlug = vizitka.season.replace("/", "-");
  const banded = vizitka.licensing?.areas.filter((a) => a.band !== null).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={vizitka.club.name} size="xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="title-1 break-words">{vizitka.club.name}</h1>
            <span className="subheadline text-(--ink-muted)">
              {t("union", { union: vizitka.club.union, region: vizitka.club.region })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {vizitka.profile && <Badge tone="brand">{t(`size.${vizitka.profile.size}`)}</Badge>}
          {vizitka.kompas?.confirmed && <ConfirmedBadge />}
        </div>
        <p className="footnote text-(--ink-muted)">
          {vizitka.profile ? t("profile", vizitka.profile) : t("noProfile")}
        </p>
        {vizitka.seasons.length > 1 && (
          <nav
            aria-label={t("season")}
            className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
          >
            {vizitka.seasons.map((s) => (
              <LinkChip key={s} href={seasonHref(s)} selected={s === vizitka.season}>
                {s}
              </LinkChip>
            ))}
          </nav>
        )}
        <p className="callout text-(--ink-muted)">{club ? t("clubIntro") : t("publicIntro")}</p>
      </header>

      {(vizitka.kompas || vizitka.licensing) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-(--radius-md) bg-(--surface-raised) p-4">
            <span className="label text-(--ink-muted)">{t("kompas.title")}</span>
            <span className="title-1 tabular-nums">
              {vizitka.kompas ? t("kompas.short", { total: vizitka.kompas.total }) : "–"}
            </span>
            <span className="footnote text-(--ink-muted)">
              {vizitka.kompas
                ? t("kompas.filled", { filled: vizitka.kompas.filledAreas })
                : t("kompas.none")}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-(--radius-md) bg-(--surface-raised) p-4">
            <span className="label text-(--ink-muted)">{t("licensing.title")}</span>
            <span className="title-1 tabular-nums">
              {vizitka.licensing
                ? t("licensing.short", { banded, total: vizitka.licensing.areas.length })
                : "–"}
            </span>
            <span className="footnote text-(--ink-muted)">
              {vizitka.licensing ? t("licensing.banded") : t("licensing.none")}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t("kompas.byArea")}
          flush
          footer={
            club ? (
              <div className="footnote flex flex-col gap-1">
                {club.kompasSubmittedAt && (
                  <span className="text-(--ink-muted)">
                    {t("kompas.submittedAt", { date: date(club.kompasSubmittedAt) })}
                  </span>
                )}
                {club.drafts.kompasVersion > 0 && !club.kompasSubmittedAt && (
                  <span>{t("kompas.draftOnly", { version: club.drafts.kompasVersion })}</span>
                )}
                {club.kompasLink && (
                  <Link
                    href={
                      club.kompasLink.kind === "assessment"
                        ? `${base}/kompas`
                        : `${base}/kompas/odoslane/${encodeURIComponent(club.kompasLink.submissionId)}`
                    }
                    className="subheadline font-semibold"
                  >
                    {t("kompas.link")}
                  </Link>
                )}
              </div>
            ) : undefined
          }
        >
          {vizitka.kompas ? (
            <ol>
              {vizitka.kompas.areas.map((a) => (
                <li
                  key={a.area}
                  className="flex min-h-12 items-center gap-3 border-t border-(--hairline) px-4 py-2 first:border-t-0"
                >
                  <span className="w-6 shrink-0 font-bold text-(--ink-muted)">{a.area}</span>
                  <span className="subheadline min-w-0 flex-1 break-words">{a.name}</span>
                  <span className="subheadline text-(--ink-muted) tabular-nums">
                    {a.points !== null
                      ? t("kompas.points", { points: a.points })
                      : a.status === "few"
                        ? t("kompas.few")
                        : t("kompas.empty")}
                  </span>
                  {a.band && (
                    <KompasBandBadge band={a.band}>{tKompasBands(a.band)}</KompasBandBadge>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="callout px-4 pb-4 text-(--ink-muted)">{t("kompas.none")}</p>
          )}
        </Card>

        <Card
          title={t("licensing.title")}
          flush
          footer={
            club ? (
              <div className="footnote flex flex-col gap-1">
                {club.licensingClosedAt && club.licensingCoefficient !== null && (
                  <span className="text-(--ink-muted)">
                    {t("licensing.closedAt", {
                      date: date(club.licensingClosedAt),
                      coef: num(club.licensingCoefficient),
                    })}
                  </span>
                )}
                {club.drafts.licensingVersion > 0 && !club.licensingClosedAt && (
                  <span>{t("licensing.draftOnly", { version: club.drafts.licensingVersion })}</span>
                )}
                <Link
                  href={`${base}/licencne-hodnotenie?season=${seasonSlug}`}
                  className="subheadline font-semibold"
                >
                  {t("licensing.link")}
                </Link>
              </div>
            ) : undefined
          }
        >
          {vizitka.licensing ? (
            <ol>
              {vizitka.licensing.areas.map((a) => (
                <li
                  key={a.key}
                  className="flex min-h-12 items-center gap-3 border-t border-(--hairline) px-4 py-2 first:border-t-0"
                >
                  <span className="subheadline min-w-0 flex-1 break-words">
                    {a.area}. {tLicensing(`areas.${a.key}`)}
                  </span>
                  <span className="subheadline text-(--ink-muted) tabular-nums">
                    {tLicensing("points", { points: num(a.points) })}
                  </span>
                  <LicensingBandPill band={a.band ?? "none"}>
                    {a.status === "empty"
                      ? tLicensing("bands.empty")
                      : a.status === "unbanded"
                        ? tLicensing("bands.unbanded")
                        : a.band
                          ? tLicensing(`bands.${a.band}`)
                          : tLicensing("bands.none")}
                  </LicensingBandPill>
                </li>
              ))}
            </ol>
          ) : (
            <p className="callout px-4 pb-4 text-(--ink-muted)">{t("licensing.none")}</p>
          )}
        </Card>
      </div>
      <p className="footnote text-(--ink-muted)">{tLicensing("overallPending")}</p>
    </div>
  );
}
