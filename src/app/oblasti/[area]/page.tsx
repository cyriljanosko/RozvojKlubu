import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { MarkdownContent } from "@/components/content/markdown";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoSectionStore } from "@/server/db/content.store";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { listMethodology } from "@/server/services/methodology.service";

export const metadata: Metadata = { title: defaultMessages.areas.title };

async function AreaDetail({ params }: PageProps<"/oblasti/[area]">) {
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
  const sections = await listMethodology(mongoSectionStore, user, number);
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
            href={`/admin/obsah/${area.number}/metodika`}
            className="text-sm font-medium underline underline-offset-4"
          >
            {t("edit")}
          </Link>
        )}
      </header>

      {sections.length === 0 ? (
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
