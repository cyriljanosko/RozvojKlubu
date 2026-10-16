import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { HubIllustration } from "@/components/hub/hub-illustration";
import { HubMemory } from "@/components/hub/hub-memory";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { hubDeps } from "@/server/clubs/deps";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { getHub, splitAreas, type HubSelection } from "@/server/services/hub.service";

const BAND: Record<number, string> = {
  1: "border-l-blue-600",
  2: "border-l-amber-600",
  3: "border-l-zinc-500",
};
const BAND_RING: Record<number, string> = {
  1: "border-blue-600",
  2: "border-amber-600",
  3: "border-zinc-500",
};

type Props = PageProps<"/">;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

/** Public Hub (ADR 0011): track, role lens and club reorder the 11 areas; no sign-in needed. */
async function Hub({ searchParams }: Props) {
  await connection();
  const t = await getTranslations("hub");
  const tTags = await getTranslations("questionTags");
  const q = await searchParams;
  const selection: HubSelection = { track: str(q.track), role: str(q.role), club: str(q.club) };
  const user = isDatabaseConfigured()
    ? await getCurrentUser(await headers()).catch(() => null)
    : null;
  const hub = await getHub(hubDeps, user, selection);
  if (!hub) return <p className="text-sm">{t("lead")}</p>;

  const href = (change: Partial<Record<"track" | "role" | "club", string | null>>) => {
    const next = new URLSearchParams();
    const merged = {
      track: hub.track.key,
      role: hub.role.key,
      club: hub.club?.clubId ?? null,
      ...change,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/?${next.toString()}`;
  };
  const approved = hub.track.status === "approved";
  const areaHref = (n: number) =>
    hub.role.whole ? `/oblasti/${n}` : `/oblasti/${n}?role=${encodeURIComponent(hub.role.key)}`;

  const tile = (a: (typeof hub.areas)[number], lead: boolean) => {
    const body = (
      <>
        <span className="text-muted-foreground text-xs font-semibold">
          {a.number} · {t(`bands.${a.band}`)}
          {!a.hasDetail && ` · ${t("preparing")}`}
        </span>
        <span className={`font-semibold break-words ${lead ? "text-lg" : ""}`}>{a.name}</span>
        <span className="text-muted-foreground text-sm">{a.line ?? a.teaser}</span>
      </>
    );
    const cls = `flex h-full flex-col gap-1 rounded-xl border border-l-4 p-3 ${BAND[a.band]} ${a.hasDetail ? "hover:bg-muted/50" : "opacity-80"}`;
    return a.hasDetail ? (
      <Link href={areaHref(a.number)} className={cls}>
        {body}
      </Link>
    ) : (
      <div className={cls}>{body}</div>
    );
  };

  const kompasHref = `/kompas${hub.club ? `?club=${encodeURIComponent(hub.club.clubId)}` : ""}`;
  const whole = hub.roles.find((r) => r.whole);
  const roleCards = hub.roles.filter((r) => !r.whole);
  const { priority, next, others } = splitAreas(hub.areas);

  const row = (a: (typeof hub.areas)[number]) => {
    const body = (
      <>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${BAND_RING[a.band]}`}
        >
          {a.number}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-medium break-words">{a.name}</span>
          <span className="text-muted-foreground text-xs">
            {t(`bands.${a.band}`)}
            {!a.hasDetail && ` · ${t("preparing")}`}
          </span>
        </span>
      </>
    );
    const cls = "flex items-center gap-3 rounded-lg px-2 py-2";
    return a.hasDetail ? (
      <Link href={areaHref(a.number)} className={`${cls} hover:bg-muted/50`}>
        {body}
      </Link>
    ) : (
      <div className={cls}>{body}</div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <HubMemory />
      {!approved && (
        <p className="rounded-lg border border-dashed p-3 text-sm">
          <span className="font-semibold">{hub.track.name}</span> · {t("preparingTrack")}{" "}
          {hub.tracks
            .filter((tr) => tr.status === "approved")
            .map((tr) => (
              <Link
                key={tr.key}
                href={href({ track: tr.key, role: null })}
                className="font-medium underline underline-offset-4"
              >
                {t("backTo", { track: tr.name })}
              </Link>
            ))}
        </p>
      )}

      <header className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm font-medium">{t("eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground max-w-2xl">{t("lead")}</p>
        </div>
        <HubIllustration className="mx-auto max-w-64 sm:max-w-sm" />
      </header>

      <section aria-labelledby="hub-role" className="flex flex-col gap-3">
        <div>
          <h2 id="hub-role" className="text-xl font-semibold">
            {t("roleTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("roleLead")}</p>
        </div>
        <nav aria-label={t("roleTitle")}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {roleCards.map((r) => (
              <li key={r.key}>
                <Link
                  href={href({ role: r.key })}
                  aria-current={r.key === hub.role.key ? "page" : undefined}
                  className="hover:bg-muted/50 aria-[current=page]:border-primary aria-[current=page]:bg-primary/5 flex h-full flex-col gap-1 rounded-xl border p-3 aria-[current=page]:border-2"
                >
                  <span className="font-semibold break-words">{r.name}</span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">{r.who}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {hub.defaultsFrom === "membership" && <p className="text-xs">{t("fromMembership")}</p>}
        {!hub.role.whole && (
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              {t("whoTitle")} <span className="text-muted-foreground">· {hub.role.name}</span>
            </summary>
            <dl className="mt-2 grid gap-2">
              {(["who", "see", "why"] as const).map((k) => (
                <div key={k}>
                  <dt className="text-muted-foreground text-xs font-semibold">{t(k)}</dt>
                  <dd>{hub.role.info[k]}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground mt-2 text-xs">{t("roleHint")}</p>
          </details>
        )}
        {!hub.role.whole && whole && (
          <Link
            href={href({ role: whole.key })}
            className="self-start text-sm underline underline-offset-4"
          >
            {t("noRole")}
          </Link>
        )}
      </section>

      <section
        aria-labelledby="hub-kompas-info"
        className="flex flex-col gap-1 rounded-xl border-l-4 border-l-amber-600 bg-amber-50 p-4 text-sm dark:bg-amber-950/30"
      >
        <h2 id="hub-kompas-info" className="font-semibold">
          {t("kompasInfo.title")}
        </h2>
        <p className="text-muted-foreground">
          {approved ? t("kompasInfo.text") : t("kompas.preparing")}
        </p>
        {approved && (
          <Link href={kompasHref} className="self-start font-medium underline underline-offset-4">
            {t("kompasInfo.link")}
          </Link>
        )}
      </section>

      <section aria-labelledby="hub-areas" className="flex flex-col gap-4">
        <h2 id="hub-areas" className="text-xl font-semibold">
          {hub.role.whole
            ? approved
              ? t("areas")
              : t("areasAk")
            : t("priorityTitle", { role: hub.role.name })}
        </h2>
        {hub.role.start && (
          <div className="border-l-primary flex flex-col gap-2 border-l-4 pl-4">
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">
              {t("start")}
            </p>
            <p className="font-semibold">{hub.role.start.title}</p>
            <p className="text-muted-foreground text-sm">{hub.role.start.text}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {hub.role.start.steps.map((s) => (
                <li key={s.title}>
                  <span className="font-semibold">{s.title}</span> – {s.text}
                </li>
              ))}
            </ol>
            {approved && (
              <Link
                href={
                  hub.role.start.cta.area === 0 ? kompasHref : areaHref(hub.role.start.cta.area)
                }
                className="text-primary self-start text-sm font-semibold underline-offset-4 hover:underline"
              >
                {hub.role.start.cta.label} →
              </Link>
            )}
            {hub.role.draft && <p className="text-muted-foreground text-xs">{t("draft")}</p>}
          </div>
        )}
        {hub.role.whole ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hub.areas.map((a) => (
              <li key={a.number}>{tile(a, false)}</li>
            ))}
          </ul>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-3">
              {priority.map((a) => (
                <li key={a.number}>{tile(a, true)}</li>
              ))}
            </ul>
            {next.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{t("nextTitle")}</h3>
                <p className="text-muted-foreground text-sm">{t("nextText")}</p>
                <ul className="grid sm:grid-cols-2">
                  {next.map((a) => (
                    <li key={a.number}>{row(a)}</li>
                  ))}
                </ul>
              </div>
            )}
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer font-semibold">
                {t("others")}{" "}
                <span className="text-muted-foreground text-sm font-normal">· {others.length}</span>
              </summary>
              <ul className="mt-2 grid sm:grid-cols-2">
                {others.map((a) => (
                  <li key={a.number}>{row(a)}</li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>

      <section
        id="kompas"
        aria-labelledby="hub-kompas"
        className="flex flex-col gap-3 rounded-2xl border-2 border-amber-600 p-4"
      >
        <h2 id="hub-kompas" className="text-xl font-semibold">
          {t("kompas.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {approved ? t("kompas.text") : t("kompas.preparing")}
        </p>
        {approved && (
          <details className="rounded-lg border p-3 text-sm" open={!hub.club}>
            <summary className="cursor-pointer font-medium">
              {hub.club ? (
                <>
                  {hub.club.name}{" "}
                  <span className="text-muted-foreground">· {t("club.change")}</span>
                </>
              ) : (
                t("club.pick")
              )}
            </summary>
            <p className="text-muted-foreground mt-2 text-xs">{t("club.hint")}</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {hub.clubs.map((c) => (
                <li key={c.clubId}>
                  <Link
                    href={`${href({ club: c.clubId })}#kompas`}
                    aria-current={c.clubId === hub.club?.clubId ? "page" : undefined}
                    className="hover:bg-muted/50 aria-[current=page]:border-primary flex flex-col rounded-md border px-2 py-1.5"
                  >
                    <span className="font-medium break-words">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.union}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {hub.club && (
              <Link
                href={`${href({ club: null })}#kompas`}
                className="mt-2 inline-block text-xs underline underline-offset-4"
              >
                {t("club.none")}
              </Link>
            )}
          </details>
        )}
        {hub.club && (
          <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3 text-sm">
            <p className="font-semibold break-words">
              {hub.club.name}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                · {hub.club.union} · {t("club.season", { season: hub.club.season })}
              </span>
            </p>
            <p>
              <span className="bg-primary text-primary-foreground mr-2 rounded-full px-2 py-0.5 text-xs">
                {t(`club.size.${hub.club.size}`)}
              </span>
              {t("club.profile", {
                teams: hub.club.teams,
                players: hub.club.players,
                coaches: hub.club.coaches,
              })}
            </p>
            {hub.club.categories.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {t("club.categories")}: {hub.club.categories.map((c) => tTags(c)).join(", ")}
              </p>
            )}
            <Link
              href={`/vizitka/${encodeURIComponent(hub.club.clubId)}`}
              className="self-start text-xs underline underline-offset-4"
            >
              {t("club.vizitka")}
            </Link>
          </div>
        )}
        {approved && (
          <Button asChild className="self-start bg-amber-600 hover:bg-amber-700">
            <Link href={kompasHref}>{t("kompas.button")}</Link>
          </Button>
        )}
      </section>

      <footer className="flex flex-col gap-3 border-t pt-6">
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">{t("about.title")}</summary>
          <p className="mt-2 text-sm">{t("about.text")}</p>
        </details>
        {!user && (
          <div className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
            <p className="font-semibold">{t("about.academy")}</p>
            <p className="text-muted-foreground">{t("about.academyText")}</p>
            <Button asChild size="sm" className="self-start">
              <Link href="/prihlasenie">{t("about.signIn")}</Link>
            </Button>
          </div>
        )}
        <nav
          aria-label={t("track")}
          className="text-muted-foreground flex flex-wrap gap-x-4 text-sm"
        >
          {hub.tracks
            .filter((tr) => tr.key !== hub.track.key)
            .map((tr) => (
              <Link
                key={tr.key}
                href={href({ track: tr.key, role: null, club: null })}
                className="underline underline-offset-4"
              >
                {tr.name}
                {tr.status === "preparing" && ` · ${t("preparing")}`}
              </Link>
            ))}
        </nav>
      </footer>
    </div>
  );
}

export default function Home(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Hub {...props} />
      </Suspense>
    </main>
  );
}
