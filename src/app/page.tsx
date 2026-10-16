import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { HubMemory } from "@/components/hub/hub-memory";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { hubDeps } from "@/server/clubs/deps";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { getHub, type HubSelection } from "@/server/services/hub.service";

const BAND: Record<number, string> = {
  1: "border-l-blue-600",
  2: "border-l-amber-600",
  3: "border-l-zinc-500",
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
  const forRole = hub.areas.filter((a) => a.forRole);
  const others = hub.areas.filter((a) => !a.forRole);
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

  return (
    <div className="flex flex-col gap-6">
      <HubMemory />
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl">{t("lead")}</p>
      </header>

      <section aria-labelledby="hub-role" className="flex flex-col gap-3 rounded-2xl border p-4">
        <nav aria-label={t("track")} className="flex flex-wrap gap-1 rounded-lg border p-1 text-sm">
          {hub.tracks.map((tr) => (
            <Link
              key={tr.key}
              href={href({
                track: tr.key,
                role: null,
                club: tr.status === "approved" ? (hub.club?.clubId ?? null) : null,
              })}
              aria-current={tr.key === hub.track.key ? "page" : undefined}
              className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground flex-1 rounded-md px-3 py-1.5 text-center"
            >
              {tr.name}
              {tr.status === "preparing" && (
                <span className="text-xs opacity-80"> · {t("preparing")}</span>
              )}
            </Link>
          ))}
        </nav>
        <div>
          <h2 id="hub-role" className="text-lg font-semibold">
            {t("roleTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{hub.track.intro}</p>
        </div>
        <nav aria-label={t("roleTitle")} className="flex gap-1 overflow-x-auto pb-1 text-sm">
          {hub.roles.map((r) => (
            <Link
              key={r.key}
              href={href({ role: r.key })}
              aria-current={r.key === hub.role.key ? "page" : undefined}
              className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground shrink-0 rounded-md border px-3 py-1.5 whitespace-nowrap"
            >
              {r.name}
            </Link>
          ))}
        </nav>
        {hub.defaultsFrom === "membership" && <p className="text-xs">{t("fromMembership")}</p>}
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
                    href={href({ club: c.clubId })}
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
                href={href({ club: null })}
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
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {hub.role.start ? (
          <section
            aria-labelledby="hub-start"
            className="border-l-primary flex flex-col gap-2 rounded-xl border border-l-4 p-4"
          >
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">
              {t("start")}
            </p>
            <h2 id="hub-start" className="text-lg font-semibold">
              {hub.role.start.title}
            </h2>
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
                  hub.role.start.cta.area === 0
                    ? `/kompas${hub.club ? `?club=${encodeURIComponent(hub.club.clubId)}` : ""}`
                    : areaHref(hub.role.start.cta.area)
                }
                className="text-primary self-start text-sm font-semibold underline-offset-4 hover:underline"
              >
                {hub.role.start.cta.label} →
              </Link>
            )}
            {hub.role.draft && <p className="text-muted-foreground text-xs">{t("draft")}</p>}
          </section>
        ) : (
          <div className="hidden lg:block" />
        )}
        <aside
          aria-labelledby="hub-kompas"
          className="flex flex-col gap-2 rounded-xl border-2 border-amber-600 p-4"
        >
          <h2 id="hub-kompas" className="text-lg font-semibold">
            {t("kompas.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {approved ? t("kompas.text") : t("kompas.preparing")}
          </p>
          {approved && (
            <Button asChild className="mt-auto bg-amber-600 hover:bg-amber-700">
              <Link
                href={`/kompas${hub.club ? `?club=${encodeURIComponent(hub.club.clubId)}` : ""}`}
              >
                {t("kompas.button")}
              </Link>
            </Button>
          )}
        </aside>
      </div>

      <section aria-labelledby="hub-areas" className="flex flex-col gap-3">
        <h2 id="hub-areas" className="text-xl font-semibold">
          {approved ? t("areas") : t("areasAk")}
        </h2>
        {!hub.role.whole && forRole.length > 0 && (
          <>
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t("forRole")}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {forRole.map((a) => (
                <li key={a.number}>{tile(a, true)}</li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t("others")}
            </p>
          </>
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(hub.role.whole ? hub.areas : others).map((a) => (
            <li key={a.number}>{tile(a, false)}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
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
      </section>
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
