import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CopyLine } from "@/components/content/copy-line";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getClubOverview } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";
import type { KompasResult } from "@/server/services/kompas-scoring";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import { currentSeason } from "@/server/services/season";
import { getSubmission, isValidSubmission } from "@/server/services/kompas-submission.service";

import { ConfirmSubmission } from "./confirm-submission";
import { WithdrawSubmission } from "./withdraw-submission";

export const metadata: Metadata = { title: defaultMessages.kompas.submission.title };

async function Submission({ params }: PageProps<"/klub/[clubId]/kompas/odoslane/[submissionId]">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const { clubId: rawClubId, submissionId } = await params;
  const clubId = decodeURIComponent(rawClubId);
  const t = await getTranslations("kompas");
  const tClub = await getTranslations("club");

  let sub;
  try {
    sub = await getSubmission(submissionDeps, user, clubId, submissionId);
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
  const [club, areas, memberships] = await Promise.all([
    getClubOverview(submissionDeps, user, clubId),
    listAreas(mongoContentStore, user),
    submissionDeps.memberships.listByUser(user.id),
  ]);
  // the club's mentor of the season or admin_sfz may confirm (ADR 0015)
  const canConfirm =
    isAdmin(user) || clubRolesFor(memberships, clubId, currentSeason()).includes("mentor");
  const result = sub.result as unknown as KompasResult;
  const checked = new Set(sub.answers);
  const date = sub.submittedAt.toLocaleString("sk", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Bratislava",
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}/kompas`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {t("submission.back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {t("submission.title")} · {club.club.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("submission.meta", { date, season: sub.season })}
        </p>
        <p className="text-sm">{t("submission.frozen")}</p>
        {!isValidSubmission(sub) && sub.withdrawnAt && (
          <p className="bg-muted rounded-md p-3 text-sm">
            {t("withdraw.withdrawn", {
              date: sub.withdrawnAt.toLocaleString("sk", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Bratislava",
              }),
            })}
          </p>
        )}
        {isValidSubmission(sub) && sub.confirmedAt && (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {t("confirm.confirmed", {
              date: sub.confirmedAt.toLocaleDateString("sk", {
                dateStyle: "medium",
                timeZone: "Europe/Bratislava",
              }),
            })}
          </p>
        )}
        {isValidSubmission(sub) && canConfirm && (
          <ConfirmSubmission
            clubId={clubId}
            submissionId={sub.id}
            confirmed={Boolean(sub.confirmedAt)}
          />
        )}
        {isValidSubmission(sub) && isAdmin(user) && (
          <WithdrawSubmission clubId={clubId} submissionId={sub.id} />
        )}
      </header>
      <section className="bg-primary text-primary-foreground flex flex-col gap-1 rounded-xl p-4">
        <p className="text-2xl font-semibold tabular-nums">{t("total", { total: result.total })}</p>
        <p className="text-sm opacity-90">{t("filled", { filled: result.filledAreas })}</p>
      </section>
      <CopyLine line={sub.line} />
      <ol className="flex flex-col gap-3">
        {result.areas.map((a) => {
          const name = areas.find((x) => x.number === a.area)?.name ?? "";
          const hits = sub.questions.filter(
            (q) => checked.has(q.questionId) && q.questionId.startsWith(`${a.area}.`),
          );
          return (
            <li key={a.area} className="rounded-xl border p-4">
              <h2 className="flex flex-wrap items-baseline justify-between gap-2 font-semibold">
                <span className="break-words">
                  {a.area}. {name}
                </span>
                <span className="text-sm tabular-nums">
                  {a.points !== null
                    ? t("areaScore", { points: a.points })
                    : a.status === "few"
                      ? t("areaFew")
                      : t("areaEmpty")}
                </span>
              </h2>
              {hits.length > 0 && (
                <ul className="text-muted-foreground mt-2 list-disc pl-5 text-sm">
                  {hits.map((q) => (
                    <li key={q.questionId}>{q.text}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function SubmissionPage(
  props: PageProps<"/klub/[clubId]/kompas/odoslane/[submissionId]">,
) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Submission {...props} />
      </Suspense>
    </main>
  );
}
