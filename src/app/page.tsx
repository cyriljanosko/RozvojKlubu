import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AreaLineList, AreaRow, type AreaRowData } from "@/components/areas/area-lines";
import { HubMemory } from "@/components/hub/hub-memory";
import { HomeNews } from "@/components/news/news-blocks";
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Card,
  Icon,
  IconButton,
  Input,
  LinkButton,
  LinkChip,
} from "@/components/sfz";
import { getCurrentUser } from "@/server/auth/session";
import { hubDeps } from "@/server/clubs/deps";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { getHub, splitAreas, type HubArea, type HubSelection } from "@/server/services/hub.service";

type Props = PageProps<"/">;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

/**
 * Public Hub "Akadémia" (ADR 0011) on the SFZ Design System (R4 G1a, approved design R2a):
 * track, role and club reorder the 11 areas; no sign-in needed. Signed-in people have their
 * dashboard in Moja Akadémia (Domov), so the Hub shows the same public content to everyone.
 */
async function Hub({ searchParams }: Props) {
  await connection();
  const [t, tTags, tSearch] = await Promise.all([
    getTranslations("hub"),
    getTranslations("questionTags"),
    getTranslations("search"),
  ]);
  const q = await searchParams;
  const selection: HubSelection = { track: str(q.track), role: str(q.role), club: str(q.club) };
  const user = isDatabaseConfigured()
    ? await getCurrentUser(await headers()).catch(() => null)
    : null;
  const hub = await getHub(hubDeps, user, selection);
  if (!hub) return <p className="body">{t("lead")}</p>;

  const href = (
    change: Partial<Record<"track" | "role" | "club", string | null>>,
    /** section to land on after the reload (choosing a role → its areas, 26. 10. 2026) */
    anchor?: string,
  ) => {
    const next = new URLSearchParams();
    const merged = {
      track: hub.track.key,
      role: hub.role.key,
      club: hub.club?.clubId ?? null,
      ...change,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/?${next.toString()}${anchor ? `#${anchor}` : ""}`;
  };
  const approved = hub.track.status === "approved";
  const areaHref = (n: number) =>
    hub.role.whole ? `/oblasti/${n}` : `/oblasti/${n}?role=${encodeURIComponent(hub.role.key)}`;
  const kompasHref = `/kompas${hub.club ? `?club=${encodeURIComponent(hub.club.clubId)}` : ""}`;
  const whole = hub.roles.find((r) => r.whole);
  const { priority, next, others } = splitAreas(hub.areas);

  const row = (a: HubArea): AreaRowData => ({
    number: a.number,
    name: a.name,
    text: a.line ?? a.teaser,
    href: a.hasDetail ? areaHref(a.number) : null,
    note: a.hasDetail ? undefined : t("preparing"),
  });

  return (
    <div className="flex flex-col gap-10">
      <HubMemory />

      {!approved && (
        <Alert tone="warning" title={hub.track.name}>
          {t("preparingTrack")}{" "}
          {hub.tracks
            .filter((tr) => tr.status === "approved")
            .map((tr) => (
              <Link
                key={tr.key}
                href={href({ track: tr.key, role: null })}
                className="font-semibold text-(--warning-ink)"
              >
                {t("backTo", { track: tr.name })}
              </Link>
            ))}
        </Alert>
      )}

      <header className="flex flex-col gap-3">
        <p className="caption-2 text-(--brand-blue-ink) uppercase">{t("eyebrow")}</p>
        <h1 className="large-title sm:text-5xl sm:leading-tight">{t("title")}</h1>
        <p className="body max-w-2xl text-(--ink-muted)">{t("lead")}</p>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          {approved && (
            <LinkButton href={kompasHref} icon="check-circle">
              {t("cta.kompas")}
            </LinkButton>
          )}
          <LinkButton href="/o-akademii" variant="tertiary">
            {t("how.title")}
          </LinkButton>
        </div>
      </header>

      <section aria-labelledby="hub-role" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="hub-role" className="title-3">
            {t("roleTitle")}
          </h2>
          <p className="subheadline text-(--ink-muted)">{t("roleLead")}</p>
        </div>
        <nav aria-label={t("roleTitle")} className="flex flex-wrap gap-2">
          {hub.roles.map((r) => (
            <LinkChip
              key={r.key}
              href={href({ role: r.key }, "hub-areas")}
              selected={r.key === hub.role.key}
            >
              {r.name}
            </LinkChip>
          ))}
        </nav>
        {hub.defaultsFrom === "membership" && (
          <p className="footnote text-(--ink-muted)">{t("fromMembership")}</p>
        )}
        {!hub.role.whole && (
          <Accordion>
            <AccordionItem title={t("whoTitle")} subtitle={hub.role.name}>
              <dl className="flex flex-col gap-3">
                {(["who", "see", "why"] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-0.5">
                    <dt className="label text-(--ink-muted)">{t(k)}</dt>
                    <dd className="callout">{hub.role.info[k]}</dd>
                  </div>
                ))}
              </dl>
              <p className="footnote mt-3 text-(--ink-muted)">{t("roleHint")}</p>
            </AccordionItem>
          </Accordion>
        )}
      </section>

      {hub.role.start && (
        <Card variant="highlight" title={`${t("start")}: ${hub.role.name}`}>
          <div className="flex flex-col gap-4">
            <p className="callout">
              <span className="font-semibold">{hub.role.start.title}</span> – {hub.role.start.text}
            </p>
            <ol className="flex flex-col gap-3">
              {hub.role.start.steps.map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-(--brand-blue) text-[13px] font-bold text-(--on-brand)">
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="headline">{s.title}</span>
                    <span className="footnote text-(--ink-muted)">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            {approved && (
              <LinkButton
                href={
                  hub.role.start.cta.area === 0 ? kompasHref : areaHref(hub.role.start.cta.area)
                }
                variant="secondary"
              >
                {hub.role.start.cta.label}
              </LinkButton>
            )}
            {hub.role.draft && <p className="footnote text-(--ink-muted)">{t("draft")}</p>}
          </div>
        </Card>
      )}

      <section id="hub-areas" aria-labelledby="hub-areas-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="hub-areas-title" className="title-2">
            {hub.role.whole
              ? approved
                ? t("areas")
                : t("areasAk")
              : t("priorityTitle", { role: hub.role.name })}
          </h2>
          {hub.role.whole && <p className="subheadline text-(--ink-muted)">{t("linesLead")}</p>}
        </div>
        {hub.role.whole ? (
          <AreaLineList areas={hub.areas.map(row)} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised) ring-2 ring-(--brand-blue-ink)">
              {priority.map((a) => (
                <AreaRow key={a.number} area={row(a)} />
              ))}
            </ul>
            {next.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="headline">{t("nextTitle")}</h3>
                <p className="footnote text-(--ink-muted)">{t("nextText")}</p>
                <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
                  {next.map((a) => (
                    <AreaRow key={a.number} area={row(a)} />
                  ))}
                </ul>
              </div>
            )}
            <Accordion>
              <AccordionItem title={`${t("others")} · ${others.length}`}>
                <ul className="-mx-4">
                  {others.map((a) => (
                    <AreaRow key={a.number} area={row(a)} />
                  ))}
                </ul>
              </AccordionItem>
            </Accordion>
            {whole && (
              <Link
                href={href({ role: whole.key }, "hub-areas")}
                className="subheadline self-start text-(--brand-blue-ink)"
              >
                {t("noRole")}
              </Link>
            )}
          </>
        )}
      </section>

      <section id="kompas" aria-labelledby="hub-kompas">
        <Card title={t("kompas.title")}>
          <div className="flex flex-col gap-4">
            <p className="callout text-(--ink-muted)">
              {approved ? t("kompas.text") : t("kompas.preparing")}
            </p>
            {approved && (
              <Accordion>
                <AccordionItem
                  title={hub.club ? hub.club.name : t("club.pick")}
                  subtitle={hub.club ? t("club.change") : t("club.hint")}
                  defaultOpen={!hub.club}
                >
                  <nav aria-label={t("club.pick")} className="flex flex-wrap gap-2">
                    {hub.clubs.map((c) => (
                      <LinkChip
                        key={c.clubId}
                        href={`${href({ club: c.clubId })}#kompas`}
                        selected={c.clubId === hub.club?.clubId}
                      >
                        {c.name}
                      </LinkChip>
                    ))}
                    {hub.club && (
                      <LinkChip href={`${href({ club: null })}#kompas`}>{t("club.none")}</LinkChip>
                    )}
                  </nav>
                </AccordionItem>
              </Accordion>
            )}
            {hub.club && (
              <div className="flex flex-col gap-2 rounded-(--radius-md) bg-(--surface-raised) p-4">
                <p className="headline break-words">{hub.club.name}</p>
                <p className="footnote text-(--ink-muted)">
                  {hub.club.union} · {t("club.season", { season: hub.club.season })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{t(`club.size.${hub.club.size}`)}</Badge>
                  <span className="footnote">
                    {t("club.profile", {
                      teams: hub.club.teams,
                      players: hub.club.players,
                      coaches: hub.club.coaches,
                    })}
                  </span>
                </div>
                {hub.club.categories.length > 0 && (
                  <p className="footnote text-(--ink-muted)">
                    {t("club.categories")}: {hub.club.categories.map((c) => tTags(c)).join(", ")}
                  </p>
                )}
                <Link
                  href={`/vizitka/${encodeURIComponent(hub.club.clubId)}`}
                  className="footnote self-start text-(--brand-blue-ink)"
                >
                  {t("club.vizitka")}
                </Link>
              </div>
            )}
            {approved && (
              <LinkButton href={kompasHref} variant="secondary" block>
                {t("kompas.button")}
              </LinkButton>
            )}
          </div>
        </Card>
      </section>

      {/* Novinky under the Kompas card (ADR 0023); hidden while nothing is published */}
      <Suspense fallback={null}>
        <HomeNews />
      </Suspense>

      <section aria-labelledby="hub-search" className="flex flex-col gap-2">
        <h2 id="hub-search" className="title-3">
          {tSearch("homeTitle")}
        </h2>
        <p className="subheadline text-(--ink-muted)">{tSearch("homeLead")}</p>
        <form action="/hladat" role="search" className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              name="q"
              type="search"
              icon="search"
              aria-label={tSearch("label")}
              placeholder={tSearch("placeholder")}
            />
          </div>
          <IconButton type="submit" icon="search" label={tSearch("button")} variant="secondary" />
        </form>
      </section>

      <Link
        href="/vizitka"
        className="flex items-center gap-3 rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink) no-underline"
      >
        <Icon name="trophy" size={24} />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="headline">{t("clubs.title")}</span>
          <span className="footnote text-(--ink-muted)">{t("clubs.text")}</span>
        </span>
        <span className="text-(--ink-muted)" aria-hidden>
          <Icon name="chevron-right" size={18} />
        </span>
      </Link>

      {!user && (
        <Card title={t("about.academy")} variant="outline">
          <div className="flex flex-col gap-3">
            <p className="callout text-(--ink-muted)">{t("about.academyText")}</p>
            <LinkButton href="/prihlasenie" variant="secondary">
              {t("about.signIn")}
            </LinkButton>
          </div>
        </Card>
      )}

      {hub.tracks.length > 1 && (
        <nav
          aria-label={t("track")}
          className="flex flex-wrap gap-x-4 gap-y-2 border-t border-(--hairline) pt-6"
        >
          {hub.tracks
            .filter((tr) => tr.key !== hub.track.key)
            .map((tr) => (
              <Link
                key={tr.key}
                href={href({ track: tr.key, role: null, club: null })}
                className="subheadline text-(--brand-blue-ink)"
              >
                {tr.name}
                {tr.status === "preparing" && ` · ${t("preparing")}`}
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}

export default function Home(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Hub {...props} />
      </Suspense>
    </main>
  );
}
