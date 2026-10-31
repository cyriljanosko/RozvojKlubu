import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { lineOfArea } from "@/components/areas/area-lines";
import { CoachEducation } from "@/components/content/coach-education";
import { MarkdownContent } from "@/components/content/markdown";
import { sfzLinksFor } from "@/lib/sfz-links";
import { PracticeView } from "@/components/content/practice-view";
import { ScrollToHash } from "@/components/content/scroll-to-hash";
import { PinButton } from "@/components/favorites/pin-button";
import { pinnedHrefs } from "@/components/favorites/pins";
import { AreaNews } from "@/components/news/news-blocks";
import {
  Accordion,
  AccordionItem,
  AreaNumber,
  Badge,
  Card,
  EmptyState,
  Icon,
  KompasBandBadge,
  LinkButton,
  LinkChip,
  LinkTabs,
} from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, clubDeps, kompasDeps, progressDeps } from "@/server/clubs/deps";
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
  mentorPracticeRoles,
  orderSections,
  practiceRoleForHubRole,
  seesMentor,
  withoutMentor,
} from "@/server/services/hub.service";
import { currentSeason } from "@/server/services/season";
import { getRoleCatalog } from "@/server/services/role-catalog.service";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { listMyClubs } from "@/server/services/clubs.service";
import { listMethodology } from "@/server/services/methodology.service";
import { getKompas } from "@/server/services/kompas.service";
import { getPractice } from "@/server/services/practice.service";
import { getPracticeProgress } from "@/server/services/practice-progress.service";

export const metadata: Metadata = { title: defaultMessages.areas.title };

/** Practice roles that correspond to the pilot club roles (ADR 0004). */
const PRACTICE_ROLE: Record<ClubRole, string> = { management: "v", coach: "t", mentor: "m" };

async function AreaDetail({ params, searchParams }: PageProps<"/oblasti/[area]">) {
  await connection(); // public page: render per request (session optional, ADR 0011)
  const user = await getCurrentUser(await headers());
  // public page (ADR 0011); club blocks and the role default only for signed-in users
  const t = await getTranslations("areas");
  const tKompas = await getTranslations("kompas");
  const tFav = await getTranslations("favorites.labels");
  const format = await getFormatter();
  const number = Number((await params).area);
  const area = Number.isInteger(number)
    ? (await listAreas(mongoContentStore, user)).find((a) => a.number === number)
    : undefined;
  if (!area) {
    return (
      <EmptyState
        title={t("notFound")}
        action={<LinkButton href="/oblasti">{t("back")}</LinkButton>}
      />
    );
  }
  const query = await searchParams;
  const catalog = (await getRoleCatalog(mongoRoleCatalogStore, user))?.content ?? null;
  // the union mentor works behind the scenes: mentor lens and Prax only for mentors and admins
  const mentorOk = user
    ? seesMentor(user, await clubDeps.memberships.listByUser(user.id), currentSeason(new Date()))
    : false;
  const hiddenPractice = catalog && !mentorOk ? mentorPracticeRoles(catalog, number) : [];
  const stored = await getPractice(mongoPracticeStore, user, number);
  const practice = stored && {
    ...stored,
    content: {
      ...stored.content,
      roles: stored.content.roles.filter((r) => !hiddenPractice.includes(r.id)),
    },
  };
  const tab = practice && query.tab === "prax" ? "prax" : "metodika";
  const sections = tab === "metodika" ? await listMethodology(mongoSectionStore, user, number) : [];
  const roleParam = typeof query.role === "string" ? query.role : null;
  // a search hit opens its section or template (H6)
  const openKey = typeof query.open === "string" ? query.open : null;
  let roleId = roleParam ?? undefined;
  // a Hub role key (e.g. "coach") is translated to this area's Prax role (ADR 0011)
  if (practice && roleId && !practice.content.roles.some((x) => x.id === roleId)) {
    roleId = (catalog && practiceRoleForHubRole(catalog, number, roleId)) || undefined;
  }
  if (roleId && hiddenPractice.includes(roleId)) roleId = undefined;
  // Metodika for a role: from the address, else from the user's club role (ADR 0011)
  const clubTrack = catalog?.tracks?.find((tr) => tr.status === "approved") ?? null;
  const lenses = withoutMentor(clubTrack?.hubRoles.filter((h) => h.baseRole) ?? [], mentorOk);
  let methodologyRole = catalog ? baseRoleForParam(catalog, number, roleParam) : null;
  if (methodologyRole === "mentor" && !mentorOk) methodologyRole = null;
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
  // club progress in the Prax (F6d): a club where the user has a role, chosen by ?club=
  const clubParam = typeof query.club === "string" ? query.club : null;
  // own clubs (management, coach) first, then clubs the user mentors (read-only)
  const progressClubs = [
    ...myClubs.filter((c) => c.roles.some((r) => r !== "mentor")),
    ...myClubs.filter((c) => c.roles.length > 0 && c.roles.every((r) => r === "mentor")),
  ];
  const progressClub =
    progressClubs.find((c) => c.clubId === clubParam) ?? progressClubs[0] ?? null;
  const progressView =
    practice && tab === "prax" && user && progressClub
      ? await getPracticeProgress(progressDeps, user, progressClub.clubId, number).catch(() => null)
      : null;
  const base = `/oblasti/${area.number}`;
  const pins = await pinnedHrefs(user);
  const clubQuery = progressClub && clubParam ? `&club=${encodeURIComponent(clubParam)}` : "";
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });

  const tabs = practice
    ? [
        {
          id: "metodika",
          label: t("methodology"),
          href: `${base}${roleParam ? `?role=${encodeURIComponent(roleParam)}` : ""}`,
        },
        {
          id: "prax",
          label: t("practice"),
          href: `${base}?tab=prax${roleParam ? `&role=${encodeURIComponent(roleParam)}` : ""}`,
        },
      ]
    : [];
  const forRole = ordered.filter((s) => s.forRole);
  const others = ordered.filter((s) => !s.forRole);
  const lensName = lenses.find((h) => h.key === lensKey)?.name ?? null;
  const sectionItem = (s: (typeof ordered)[number]) => {
    const pinHref = `/oblasti/${area.number}?open=${encodeURIComponent(s.key)}#${s.key}`;
    return (
      <AccordionItem
        key={s.key}
        id={s.key}
        defaultOpen={openKey === s.key}
        title={
          <span className="flex items-center gap-1">
            <span className="min-w-0 flex-1 break-words">{s.title}</span>
            {pins && (
              <PinButton
                kind="section"
                href={pinHref}
                label={tFav("section", { area: area.number, title: s.title })}
                pinned={pins.has(pinHref)}
              />
            )}
          </span>
        }
      >
        {(s.validAsOf || s.reviewedAt) && (
          <p className="footnote mb-2 text-(--ink-muted)">
            {[
              s.validAsOf && t("validAsOf", { date: date(s.validAsOf) }),
              s.reviewedAt && t("reviewedAt", { date: date(s.reviewedAt) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <MarkdownContent links={sfzLinksFor(area.number)}>{s.body}</MarkdownContent>
      </AccordionItem>
    );
  };

  return (
    <article className="flex flex-col gap-6">
      <ScrollToHash />
      <header className="flex flex-col gap-3">
        <Link
          href="/oblasti"
          className="body inline-flex min-h-(--touch-target) items-center gap-1 self-start no-underline"
        >
          <Icon name="chevron-left" size={22} />
          {t("back")}
        </Link>
        <div className="flex items-center gap-2">
          <AreaNumber number={area.number} line={lineOfArea(area.number)} />
          <Badge tone="brand">{t(`bands.${area.band}`)}</Badge>
          <span className="footnote text-(--ink-muted)">
            {t("ofEleven", { number: area.number })}
          </span>
        </div>
        <div className="flex items-start gap-1">
          <h1 className="large-title min-w-0 flex-1 break-words">{area.name}</h1>
          {pins && (
            <PinButton
              kind="area"
              href={base}
              label={tFav("area", { area: area.number, name: area.name })}
              pinned={pins.has(base)}
              className="mt-1"
            />
          )}
        </div>
        <p className="body max-w-2xl text-(--ink-muted)">{area.description}</p>
        {user && isAdmin(user) && (
          <Link
            href={`/admin/obsah/${area.number}/${tab === "prax" ? "prax" : "metodika"}`}
            className="subheadline self-start font-medium"
          >
            {t("edit")}
          </Link>
        )}
      </header>

      {/* area 3 (coaches): the way to courses and continuing education on the SFZ web */}
      {area.number === 3 && <CoachEducation />}

      {practice && (
        <LinkTabs items={tabs} navLabel={t("contents")} variant="segmented" active={tab} />
      )}

      {tab === "prax" && standing.length > 0 && (
        <Card title={tKompas("practiceBlock.title")}>
          <ul className="flex flex-col gap-3">
            {standing.map(({ club, area: r }) => (
              <li key={club.clubId} className="flex flex-col gap-1">
                <span className="headline break-words">{club.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {r?.points != null ? (
                    <>
                      <span className="subheadline">
                        {tKompas("areaScore", { points: r.points })}
                      </span>
                      <KompasBandBadge band={r.band!}>
                        {tKompas(`bands.${r.band!}`)}
                      </KompasBandBadge>
                    </>
                  ) : (
                    <span className="subheadline text-(--ink-muted)">
                      {tKompas("practiceBlock.none")}
                    </span>
                  )}
                </span>
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}/kompas`}
                  className="subheadline self-start"
                >
                  {tKompas("practiceBlock.fill")}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "prax" && progressClub && progressClubs.length > 1 && (
        <nav aria-label={t("progressClub")} className="flex flex-col gap-2">
          <p className="footnote text-(--ink-muted)">{t("progressClub")}</p>
          <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1">
            {progressClubs.map((c) => (
              <LinkChip
                key={c.clubId}
                href={`${base}?tab=prax${roleId ? `&role=${encodeURIComponent(roleId)}` : ""}&club=${encodeURIComponent(c.clubId)}`}
                selected={c.clubId === progressClub.clubId}
              >
                {c.name}
              </LinkChip>
            ))}
          </div>
        </nav>
      )}

      {tab === "prax" && practice ? (
        <PracticeView
          practice={practice.content}
          roleId={roleId ?? practice.content.roles[0].id}
          hrefForRole={(id) => `${base}?tab=prax&role=${id}${clubQuery}`}
          links={sfzLinksFor(area.number)}
          pins={
            pins
              ? { hrefs: [...pins], base: `/oblasti/${area.number}?tab=prax`, area: area.number }
              : null
          }
          signedIn={Boolean(user)}
          openKey={openKey}
          progress={
            progressView && progressClub
              ? {
                  clubId: progressClub.clubId,
                  clubName: progressClub.name,
                  area: number,
                  editable: progressView.access === "edit",
                  version: progressView.version,
                  tasks: progressView.tasks,
                  steps: progressView.steps.map((x) => ({
                    ...x,
                    doneAt: x.doneAt ? new Date(x.doneAt).toISOString() : null,
                  })),
                }
              : null
          }
        />
      ) : null}

      {tab === "prax" ? null : sections.length === 0 ? (
        <p className="body text-(--ink-muted)">{t("empty")}</p>
      ) : (
        <>
          {lenses.length > 0 && (
            <nav aria-label={t("roleFor")} className="flex flex-col gap-2">
              <p className="footnote text-(--ink-muted)">{t("roleFor")}</p>
              <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1">
                <LinkChip href={base} selected={!methodologyRole}>
                  {t("allRoles")}
                </LinkChip>
                {lenses.map((h) => (
                  <LinkChip
                    key={h.key}
                    href={`${base}?role=${encodeURIComponent(h.key)}`}
                    selected={h.key === lensKey}
                  >
                    {h.name}
                  </LinkChip>
                ))}
              </div>
              {methodologyRole && areaTags?.sectionsDraft && (
                <p className="caption-1 text-(--ink-muted)">{t("tagsDraft")}</p>
              )}
            </nav>
          )}
          {forRole.length > 0 ? (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="label text-(--brand-blue-ink) uppercase">
                  {lensName ? t("forRoleGroup", { role: lensName }) : t("forYourRole")}
                </h2>
                <Accordion>{forRole.map(sectionItem)}</Accordion>
              </section>
              {others.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="label text-(--ink-muted) uppercase">{t("otherTopics")}</h2>
                  <Accordion>{others.map(sectionItem)}</Accordion>
                </section>
              )}
            </>
          ) : (
            <section className="flex flex-col gap-2">
              <h2 className="label text-(--ink-muted) uppercase">{t("methodology")}</h2>
              <Accordion>{ordered.map(sectionItem)}</Accordion>
            </section>
          )}
        </>
      )}

      {/* "Novinky k oblasti" (ADR 0023); hidden while the area has no published posts */}
      <Suspense fallback={null}>
        <AreaNews area={area.number} areaName={area.name} />
      </Suspense>
    </article>
  );
}

export default function AreaPage(props: PageProps<"/oblasti/[area]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AreaDetail {...props} />
      </Suspense>
    </main>
  );
}
