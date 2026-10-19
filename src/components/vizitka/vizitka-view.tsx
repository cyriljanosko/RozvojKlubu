import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { ClubVizitka, PublicVizitka } from "@/server/services/vizitka.service";

/** Shared Vizitka layout: club profile, Kompas and licensing evaluation side by side (ADR 0007). */

const KOMPAS_BAND: Record<string, string> = {
  start: "bg-red-600 text-white",
  rising: "bg-orange-500 text-white",
  average: "bg-zinc-500 text-white",
  good: "bg-blue-600 text-white",
  model: "bg-amber-600 text-white",
};
const LICENSING_BAND: Record<string, string> = {
  grassroots: "bg-green-700 text-white",
  bronze: "bg-orange-800 text-white",
  silver: "bg-zinc-500 text-white",
  gold: "bg-amber-600 text-white",
};
const MUTED = "bg-muted text-muted-foreground";

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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("title")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{vizitka.club.name}</h1>
        <p className="text-muted-foreground text-sm">
          {t("union", { union: vizitka.club.union, region: vizitka.club.region })}
        </p>
        {vizitka.profile ? (
          <p className="text-sm">
            <span className="bg-primary text-primary-foreground mr-2 rounded-full px-2 py-0.5 text-xs font-medium">
              {t(`size.${vizitka.profile.size}`)}
            </span>
            {t("profile", vizitka.profile)}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noProfile")}</p>
        )}
        <nav aria-label={t("season")} className="flex flex-wrap gap-2 text-sm">
          {vizitka.seasons.map((s) => (
            <Link
              key={s}
              href={seasonHref(s)}
              aria-current={s === vizitka.season ? "page" : undefined}
              className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground rounded-md border px-3 py-1.5"
            >
              {s}
            </Link>
          ))}
        </nav>
        <p className="text-sm">{club ? t("clubIntro") : t("publicIntro")}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="vizitka-kompas"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div>
            <h2 id="vizitka-kompas" className="text-lg font-semibold">
              {t("kompas.title")}
            </h2>
            <p className="text-muted-foreground text-xs">{t("kompas.subtitle")}</p>
          </div>
          {vizitka.kompas ? (
            <>
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-2xl font-semibold tabular-nums">
                  {t("kompas.total", { total: vizitka.kompas.total })}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t("kompas.filled", { filled: vizitka.kompas.filledAreas })}
                </span>
              </p>
              <ol className="divide-y rounded-md border">
                {vizitka.kompas.areas.map((a) => (
                  <li key={a.area} className="flex items-center gap-2 p-2 text-sm">
                    <span className="min-w-0 flex-1 break-words">
                      {a.area}. {a.name}
                    </span>
                    <span className="tabular-nums">
                      {a.points !== null
                        ? t("kompas.points", { points: a.points })
                        : a.status === "few"
                          ? t("kompas.few")
                          : t("kompas.empty")}
                    </span>
                    {a.band && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${KOMPAS_BAND[a.band] ?? MUTED}`}
                      >
                        {tKompasBands(a.band)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-muted-foreground rounded-md border p-3 text-sm">
              {t("kompas.none")}
            </p>
          )}
          {club && (
            <div className="flex flex-col gap-1 text-xs">
              {club.kompasSubmittedAt && (
                <span className="text-muted-foreground">
                  {t("kompas.submittedAt", { date: date(club.kompasSubmittedAt) })}
                </span>
              )}
              {club.drafts.kompasVersion > 0 && !club.kompasSubmittedAt && (
                <span>{t("kompas.draftOnly", { version: club.drafts.kompasVersion })}</span>
              )}
              <Link
                href={`${base}/kompas`}
                className="text-sm font-medium underline underline-offset-4"
              >
                {t("kompas.link")}
              </Link>
            </div>
          )}
        </section>

        <section
          aria-labelledby="vizitka-licensing"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div>
            <h2 id="vizitka-licensing" className="text-lg font-semibold">
              {t("licensing.title")}
            </h2>
            <p className="text-muted-foreground text-xs">{t("licensing.subtitle")}</p>
          </div>
          {vizitka.licensing ? (
            <ol className="divide-y rounded-md border">
              {vizitka.licensing.areas.map((a) => (
                <li key={a.key} className="flex items-center gap-2 p-2 text-sm">
                  <span className="min-w-0 flex-1 break-words">
                    {a.area}. {tLicensing(`areas.${a.key}`)}
                  </span>
                  <span className="tabular-nums">
                    {tLicensing("points", { points: num(a.points) })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.band ? LICENSING_BAND[a.band] : MUTED}`}
                  >
                    {a.status === "empty"
                      ? tLicensing("bands.empty")
                      : a.status === "unbanded"
                        ? tLicensing("bands.unbanded")
                        : a.band
                          ? tLicensing(`bands.${a.band}`)
                          : tLicensing("bands.none")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground rounded-md border p-3 text-sm">
              {t("licensing.none")}
            </p>
          )}
          {club && (
            <div className="flex flex-col gap-1 text-xs">
              {club.licensingClosedAt && club.licensingCoefficient !== null && (
                <span className="text-muted-foreground">
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
                className="text-sm font-medium underline underline-offset-4"
              >
                {t("licensing.link")}
              </Link>
            </div>
          )}
        </section>
      </div>
      <p className="text-muted-foreground text-sm">{tLicensing("overallPending")}</p>
    </div>
  );
}
