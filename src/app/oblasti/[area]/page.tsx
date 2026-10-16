import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { MarkdownContent } from "@/components/content/markdown";
import { PracticeView } from "@/components/content/practice-view";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import {
  mongoContentStore,
  mongoPracticeStore,
  mongoSectionStore,
} from "@/server/db/content.store";
import type { ClubRole } from "@/server/db/types";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { listMyClubs } from "@/server/services/clubs.service";
import { listMethodology } from "@/server/services/methodology.service";
import { getPractice } from "@/server/services/practice.service";

export const metadata: Metadata = { title: defaultMessages.areas.title };

/** Practice roles that correspond to the pilot club roles (ADR 0004). */
const PRACTICE_ROLE: Record<ClubRole, string> = { management: "v", coach: "t", mentor: "m" };

async function AreaDetail({ params, searchParams }: PageProps<"/oblasti/[area]">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("areas");
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
  let roleId = typeof query.role === "string" ? query.role : undefined;
  if (practice && tab === "prax" && !roleId) {
    const myRoles = (await listMyClubs(clubDeps, user)).flatMap((c) => c.roles);
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
        {isAdmin(user) && (
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
              href={key === "prax" ? `${base}?tab=prax` : base}
              aria-current={tab === key ? "page" : undefined}
              className="aria-[current=page]:border-primary -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium"
            >
              {key === "prax" ? t("practice") : t("methodology")}
            </Link>
          ))}
        </nav>
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
          <nav aria-label={t("contents")} className="rounded-xl border p-4">
            <h2 className="text-sm font-semibold">
              {t("methodology")} · {t("contents")}
            </h2>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.key}>
                  <a href={`#${s.key}`} className="underline-offset-4 hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((s) => (
            <section key={s.key} id={s.key} className="scroll-mt-6 rounded-xl border p-4 sm:p-6">
              <h2 className="text-lg font-semibold break-words">{s.title}</h2>
              {(s.validAsOf || s.reviewedAt) && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {[
                    s.validAsOf && t("validAsOf", { date: date(s.validAsOf) }),
                    s.reviewedAt && t("reviewedAt", { date: date(s.reviewedAt) }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <MarkdownContent>{s.body}</MarkdownContent>
            </section>
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
