import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { MarkdownContent } from "@/components/content/markdown";
import { PracticeView } from "@/components/content/practice-view";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, clubDeps, kompasDeps } from "@/server/clubs/deps";
import {
  mongoContentStore,
  mongoPracticeStore,
  mongoRoleCatalogStore,
  mongoSectionStore,
} from "@/server/db/content.store";
import type { ClubRole } from "@/server/db/types";
import { practiceRoleFor } from "@/server/services/academy.service";
import {
  baseRoleForParam,
  lensForClubRoles,
  orderSections,
  practiceRoleForHubRole,
} from "@/server/services/hub.service";
import { getRoleCatalog } from "@/server/services/role-catalog.service";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { listMyClubs } from "@/server/services/clubs.service";
import { listMethodology } from "@/server/services/methodology.service";
import { getKompas } from "@/server/services/kompas.service";
import { getPractice } from "@/server/services/practice.service";

export const metadata: Metadata = { title: defaultMessages.areas.title };

/** Practice roles that correspond to the pilot club roles (ADR 0004). */
const PRACTICE_ROLE: Record<ClubRole, string> = { management: "v", coach: "t", mentor: "m" };

async function AreaDetail({ params, searchParams }: PageProps<"/oblasti/[area]">) {
  await connection(); // public page: render per request (session optional, ADR 0011)
  const user = await getCurrentUser(await headers());
  // public page (ADR 0011); club blocks and the role default only for signed-in users
  const t = await getTranslations("areas");
  const tKompas = await getTranslations("kompas");
  const format = await getFormatter();
  const number = Number((await params).area);
  const area = Number.isInteger(number)
    ? (await listAreas(mongoContentStore, user)).find((a) => a.number === number)
    : undefined;
  if (!area) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p>{t("notFound")}</p>
        <Link href="/oblasti" className="font-medium underline underline-offset-4">
          {t("back")}
        </Link>
      </div>
    );
  }
  const query = await searchParams;
  const practice = await getPractice(mongoPracticeStore, user, number);
  const tab = practice && query.tab === "prax" ? "prax" : "metodika";
  const sections = tab === "metodika" ? await listMethodology(mongoSectionStore, user, number) : [];
  const roleParam = typeof query.role === "string" ? query.role : null;
  let roleId = roleParam ?? undefined;
  const catalog = (await getRoleCatalog(mongoRoleCatalogStore, user))?.content ?? null;
  // a Hub role key (e.g. "coach") is translated to this area's Prax role (ADR 0011)
  if (practice && roleId && !practice.content.roles.some((x) => x.id === roleId)) {
    roleId = (catalog && practiceRoleForHubRole(catalog, number, roleId)) || undefined;
  }
  // Metodika for a role: from the address, else from the user's club role (ADR 0011)
  const clubTrack = catalog?.tracks?.find((tr) => tr.status === "approved") ?? null;
  const lenses = clubTrack?.hubRoles.filter((h) => h.baseRole) ?? [];
  let methodologyRole = catalog ? baseRoleForParam(catalog, number, roleParam) : null;
  if (!methodologyRole && !roleParam && user && clubTrack && tab === "metodika") {
    const mine = (await listMyClubs(clubDeps, user)).find((c) => c.roles.length > 0);
    methodologyRole = mine ? (lensForClubRoles(clubTrack, mine.roles)?.baseRole ?? null) : null;
  }
  const areaTags = catalog?.areas.find((a) => a.area === number);
  const ordered = orderSections(sections, areaTags?.sections, methodologyRole);
  const lensKey = lenses.find((h) => h.baseRole === methodologyRole)?.key ?? null;
  const myClubs = user && practice && tab === "prax" ? await listMyClubs(clubDeps, user) : [];
  // "Kde klub stojí": this area's Kompas result for clubs where the user is management or coach
  const standing =
    practice && tab === "prax"
      ? await Promise.all(
          myClubs
            .filter((c) => c.roles.some((r) => r !== "mentor"))
            .map(async (c) => {
              const view = await getKompas(kompasDeps, user, c.clubId);
              return { club: c, area: view.result.areas.find((a) => a.area === number) };
            }),
        )
      : [];
  if (practice && tab === "prax" && !roleId) {
    // own role chosen in Moja Akadémia wins (F6b), then the club role
    const chosen = user ? await practiceRoleFor(academyDeps, user, number) : null;
    if (chosen && practice.content.roles.some((x) => x.id === chosen)) roleId = chosen;
  }
  if (practice && tab === "prax" && !roleId) {
    const myRoles = myClubs.flatMap((c) => c.roles);
    roleId = myRoles
      .map((r) => PRACTICE_ROLE[r])
      .find((id) => practice.content.roles.some((x) => x.id === id));
  }
  const base = `/oblasti/${area.number}`;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/oblasti"
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {t("back")}
        </Link>
        <p className="text-muted-foreground text-sm">
          {area.number} / 11 · {t(`bands.${area.band}`)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {area.name}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{area.description}</p>
        {user && isAdmin(user) && (
          <Link
            href={`/admin/obsah/${area.number}/${tab === "prax" ? "prax" : "metodika"}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            {t("edit")}
          </Link>
        )}
      </header>

      {practice && (
        <nav className="flex gap-2 border-b" aria-label={t("contents")}>
          {(["metodika", "prax"] as const).map((key) => (
            <Link
              key={key}
              href={
                key === "prax"
                  ? `${base}?tab=prax${roleParam ? `&role=${encodeURIComponent(roleParam)}` : ""}`
                  : `${base}${roleParam ? `?role=${encodeURIComponent(roleParam)}` : ""}`
              }
              aria-current={tab === key ? "page" : undefined}
              className="aria-[current=page]:border-primary -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium"
            >
              {key === "prax" ? t("practice") : t("methodology")}
            </Link>
          ))}
        </nav>
      )}

      {tab === "prax" && standing.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{tKompas("practiceBlock.title")}</h2>
          <ul className="flex flex-col gap-1.5">
            {standing.map(({ club, area: r }) => (
              <li key={club.clubId} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{club.name}:</span>
                <span>
                  {r?.points != null
                    ? `${tKompas("areaScore", { points: r.points })} · ${tKompas(`bands.${r.band!}`)}`
                    : tKompas("practiceBlock.none")}
                </span>
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/kompas`}
                  className="underline underline-offset-4"
                >
                  {tKompas("practiceBlock.fill")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "prax" && practice ? (
        <PracticeView
          practice={practice.content}
          roleId={roleId ?? practice.content.roles[0].id}
          hrefForRole={(id) => `${base}?tab=prax&role=${id}`}
        />
      ) : null}

      {tab === "prax" ? null : sections.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <>
          {lenses.length > 0 && (
            <nav aria-label={t("roleFor")} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("roleFor")}</p>
              <div className="flex gap-1 overflow-x-auto pb-1 text-sm">
                <Link
                  href={base}
                  aria-current={!methodologyRole ? "page" : undefined}
                  className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground shrink-0 rounded-md border px-3 py-1.5 whitespace-nowrap"
                >
                  {t("allRoles")}
                </Link>
                {lenses.map((h) => (
                  <Link
                    key={h.key}
                    href={`${base}?role=${encodeURIComponent(h.key)}`}
                    aria-current={h.key === lensKey ? "page" : undefined}
                    className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground shrink-0 rounded-md border px-3 py-1.5 whitespace-nowrap"
                  >
                    {h.name}
                  </Link>
                ))}
              </div>
              {methodologyRole && areaTags?.sectionsDraft && (
                <p className="text-muted-foreground text-xs">{t("tagsDraft")}</p>
              )}
            </nav>
          )}
          <nav aria-label={t("contents")} className="rounded-xl border p-4">
            <h2 className="text-sm font-semibold">
              {t("methodology")} · {t("contents")}
            </h2>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {ordered.map((s) => (
                <li key={s.key}>
                  <a href={`#${s.key}`} className="underline-offset-4 hover:underline">
                    {s.title}
                  </a>
                  {s.forRole && <span className="text-primary text-xs"> · {t("forYourRole")}</span>}
                </li>
              ))}
            </ol>
          </nav>
          {ordered.map((s) => (
            <details
              key={s.key}
              id={s.key}
              className={`group scroll-mt-6 rounded-xl border sm:p-0 ${s.forRole ? "border-primary bg-primary/5" : ""}`}
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 p-4 sm:px-6">
                <span className="text-lg font-semibold break-words">{s.title}</span>
                {s.forRole && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {t("forYourRole")}
                  </span>
                )}
              </summary>
              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                {(s.validAsOf || s.reviewedAt) && (
                  <p className="text-muted-foreground mb-2 text-xs">
                    {[
                      s.validAsOf && t("validAsOf", { date: date(s.validAsOf) }),
                      s.reviewedAt && t("reviewedAt", { date: date(s.reviewedAt) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <MarkdownContent>{s.body}</MarkdownContent>
              </div>
            </details>
          ))}
        </>
      )}
    </article>
  );
}

export default function AreaPage(props: PageProps<"/oblasti/[area]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AreaDetail {...props} />
      </Suspense>
    </main>
  );
}
