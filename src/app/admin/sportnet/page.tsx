import type { Metadata } from "next";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Badge, Card, Skeleton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { syncRunDeps } from "@/server/clubs/deps";
import { isAdmin } from "@/server/services/club-access";
import { CLUB_DETAILS_PER_RUN } from "@/server/services/club-import.service";
import { getSportnetSyncStatus } from "@/server/services/sync-runs.service";

import { ManualSync } from "./manual-sync";
import { SyncRuns } from "./sync-runs";

export const metadata: Metadata = { title: defaultMessages.adminSportnet.title };

/** Administrácia → Sportnet (G5, ADR 0030): state of the club sync, manual run and the last runs. */
async function SportnetSync() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const [t, format] = await Promise.all([getTranslations("adminSportnet"), getFormatter()]);
  if (!isAdmin(user)) forbidden();

  const { clubs, runs } = await getSportnetSyncStatus(syncRunDeps, user);
  const sportnetClubs = runs.find((run) => run.ok)?.result?.sportnetClubs;
  const oldest = clubs.oldestDetailsAt
    ? format.dateTime(new Date(clubs.oldestDetailsAt), { dateStyle: "medium" })
    : t("stats.none");
  const perNight = { count: CLUB_DETAILS_PER_RUN };

  return (
    <>
      {/* Phone: plain blocks in two columns (AdminMobilSportnet) */}
      <dl aria-label={t("stats.label")} className="grid grid-cols-2 gap-3 md:hidden">
        <MobileStat label={t("stats.activeClubsShort")} value={format.number(clubs.activeClubs)} />
        <MobileStat label={t("stats.withoutDetails")} value={format.number(clubs.withoutDetails)} />
        <MobileStat
          wide
          label={t("stats.oldestDetails")}
          value={`${oldest} · ${t("stats.perNightShort", perNight)}`}
        />
      </dl>

      {/* Desktop: three cards */}
      <section
        aria-label={t("stats.label")}
        className="hidden grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 md:grid"
      >
        <Card>
          <Stat
            label={t("stats.activeClubs")}
            value={format.number(clubs.activeClubs)}
            note={
              sportnetClubs !== undefined && (
                <p className="footnote text-(--ink-muted)">
                  {t("stats.sportnetClubs", { count: sportnetClubs })}
                </p>
              )
            }
          />
        </Card>
        <Card>
          <Stat
            label={t("stats.withoutDetails")}
            value={format.number(clubs.withoutDetails)}
            note={
              clubs.withoutDetails === 0 ? (
                <Badge tone="success" dot>
                  {t("stats.allDetails")}
                </Badge>
              ) : (
                <p className="footnote text-(--ink-muted)">{t("stats.someWithoutDetails")}</p>
              )
            }
          />
        </Card>
        <Card>
          <Stat
            label={t("stats.oldestDetails")}
            value={oldest}
            note={<p className="footnote text-(--ink-muted)">{t("stats.perNight", perNight)}</p>}
          />
        </Card>
      </section>

      <ManualSync />

      <SyncRuns runs={runs} />
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="footnote text-(--ink-muted)">{label}</p>
      <p className="title-1 tabular-nums">{value}</p>
      {note}
    </div>
  );
}

function MobileStat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-(--radius-md) bg-(--surface-raised) p-3 ${wide ? "col-span-2" : ""}`}
    >
      <dt className="footnote text-(--ink-muted)">{label}</dt>
      <dd className="headline tabular-nums">{value}</dd>
    </div>
  );
}

function SportnetFallback() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} shape="rect" height={112} />
        ))}
      </div>
      <Skeleton shape="rect" height={200} />
      <Skeleton shape="text" lines={4} />
    </div>
  );
}

export default async function SportnetPage() {
  const t = await getTranslations("adminSportnet");
  return (
    <main className="flex flex-col gap-4 pb-6">
      <header className="flex flex-col gap-1">
        <h1 className="title-1">{t("title")}</h1>
        <p className="callout text-(--ink-muted)">
          <span className="md:hidden">{t("leadShort")}</span>
          <span className="hidden md:inline">{t("lead")}</span>
        </p>
      </header>
      <Suspense fallback={<SportnetFallback />}>
        <SportnetSync />
      </Suspense>
    </main>
  );
}
