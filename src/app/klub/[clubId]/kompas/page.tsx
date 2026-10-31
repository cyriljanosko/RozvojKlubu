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
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  EmptyState,
  Icon,
  LinkButton,
} from "@/components/sfz";
import { kompasDeps, submissionDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import type { QuestionTag } from "@/server/db/types";
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
        <EmptyState
          title={error.code === "FORBIDDEN" ? tClub("forbidden") : tClub("notFound")}
          action={<LinkButton href="/moja-akademia">{tClub("back")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  const [areas, submissions] = await Promise.all([
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

  const latest = submissions.find((s) => !s.withdrawnAt);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-1">{t("titleSeason", { season: view.season })}</h1>
        <p className="footnote text-(--ink-muted)">
          {t("categories")}:{" "}
          {view.categories.length > 0
            ? view.categories.map((c) => tTags(c)).join(", ")
            : t("noCategories")}
          {view.categoriesFromSeason &&
            view.categoriesFromSeason !== view.season &&
            ` (${t("categoriesFrom", { season: view.categoriesFromSeason })})`}
        </p>
        {view.access === "edit" ? (
          <p className="callout text-(--ink-muted)">{t("intro")}</p>
        ) : (
          <Alert tone="info">{t("readOnly")}</Alert>
        )}
      </header>
      <KompasForm
        clubId={clubId}
        editable={view.access === "edit"}
        version={view.version}
        categories={view.categories}
        areas={areas.map((a) => ({ number: a.number, name: a.name }))}
        questions={view.questions.map((q) => ({ ...q, tags: q.tags as QuestionTag[] }))}
      />
      <section className="flex flex-col gap-2" aria-labelledby="submissions">
        <h2 id="submissions" className="title-3">
          {tSubmit("history")}
        </h2>
        {view.access === "edit" && <p className="footnote text-(--ink-muted)">{tSubmit("hint")}</p>}
        {submissions.length > 0 ? (
          <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
            {submissions.map((s) => (
              <li key={s.id} className="border-t border-(--hairline) first:border-t-0">
                <Link
                  href={`/klub/${encodeURIComponent(clubId)}/kompas/odoslane/${s.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="headline">
                      {tSubmit("rowTitle", { total: s.total, filled: s.filledAreas })}
                    </span>
                    <span className="footnote text-(--ink-muted)">
                      {tSubmit("rowDate", { date: date(s.submittedAt) })}
                    </span>
                  </span>
                  {s.withdrawnAt ? (
                    <Badge tone="danger">{tSubmit("withdrawn")}</Badge>
                  ) : s.confirmedAt ? (
                    <Badge tone="success" dot>
                      {tSubmit("confirmed")}
                    </Badge>
                  ) : null}
                  <span className="text-(--ink-muted)" aria-hidden>
                    <Icon name="chevron-right" size={18} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="callout rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink-muted)">
            {tSubmit("none")}
          </p>
        )}
        {latest && (
          <Accordion>
            <AccordionItem title={tSubmit("line")}>
              <CopyLine line={latest.line} />
            </AccordionItem>
          </Accordion>
        )}
      </section>
    </div>
  );
}

export default function KompasPage(props: PageProps<"/klub/[clubId]/kompas">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Kompas {...props} />
      </Suspense>
    </main>
  );
}
