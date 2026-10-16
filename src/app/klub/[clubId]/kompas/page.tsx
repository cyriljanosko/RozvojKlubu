import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { CopyLine } from "@/components/content/copy-line";
import { kompasDeps, submissionDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import type { QuestionTag } from "@/server/db/types";
import { getClubOverview } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";
import { listClubSubmissions } from "@/server/services/kompas-submission.service";
import { getKompas } from "@/server/services/kompas.service";

import { KompasForm } from "./kompas-form";

export const metadata: Metadata = { title: defaultMessages.kompas.title };

async function Kompas({ params }: PageProps<"/klub/[clubId]/kompas">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const t = await getTranslations("kompas");
  const tClub = await getTranslations("club");
  const tTags = await getTranslations("questionTags");

  let view;
  try {
    view = await getKompas(kompasDeps, user, clubId);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <p className="text-sm">
          {error.code === "FORBIDDEN" ? tClub("forbidden") : tClub("notFound")}
        </p>
      );
    }
    throw error;
  }
  const [club, areas, submissions] = await Promise.all([
    getClubOverview(kompasDeps, user, clubId),
    listAreas(mongoContentStore, user),
    listClubSubmissions(submissionDeps, user, clubId),
  ]);
  const tSubmit = await getTranslations("kompas.submit");
  const date = (d: Date) =>
    d.toLocaleString("sk", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Bratislava",
    });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {club.club.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("season", { season: view.season })} · {t("categories")}:{" "}
          {view.categories.length > 0
            ? view.categories.map((c) => tTags(c)).join(", ")
            : t("noCategories")}
          {view.categoriesFromSeason &&
            view.categoriesFromSeason !== view.season &&
            ` (${t("categoriesFrom", { season: view.categoriesFromSeason })})`}
        </p>
        <p className="text-sm">{view.access === "edit" ? t("intro") : t("readOnly")}</p>
      </header>
      <KompasForm
        clubId={clubId}
        editable={view.access === "edit"}
        version={view.version}
        categories={view.categories}
        areas={areas.map((a) => ({ number: a.number, name: a.name }))}
        questions={view.questions.map((q) => ({ ...q, tags: q.tags as QuestionTag[] }))}
      />
      <section className="flex flex-col gap-3" aria-labelledby="submissions">
        <h2 id="submissions" className="text-lg font-semibold">
          {tSubmit("history")}
        </h2>
        {view.access === "edit" && (
          <p className="text-muted-foreground text-sm">{tSubmit("hint")}</p>
        )}
        {submissions.length > 0 ? (
          <>
            <ul className="divide-y rounded-md border">
              {submissions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/klub/${encodeURIComponent(clubId)}/kompas/odoslane/${s.id}`}
                    className="hover:bg-muted/50 block px-3 py-2.5 text-sm"
                  >
                    {tSubmit("row", {
                      date: date(s.submittedAt),
                      total: s.total,
                      filled: s.filledAreas,
                    })}
                    {s.withdrawnAt && (
                      <span className="text-muted-foreground"> · {tSubmit("withdrawn")}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {submissions.find((s) => !s.withdrawnAt) && (
              <CopyLine line={submissions.find((s) => !s.withdrawnAt)!.line} />
            )}
          </>
        ) : (
          <p className="text-muted-foreground rounded-md border p-3 text-sm">{tSubmit("none")}</p>
        )}
      </section>
    </div>
  );
}

export default function KompasPage(props: PageProps<"/klub/[clubId]/kompas">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Kompas {...props} />
      </Suspense>
    </main>
  );
}
