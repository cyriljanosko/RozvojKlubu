import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CopyLine } from "@/components/content/copy-line";
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Card,
  EmptyState,
  Icon,
  KompasBandBadge,
  LinkButton,
} from "@/components/sfz";
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
        <EmptyState
          title={error.code === "FORBIDDEN" ? tClub("forbidden") : tClub("notFound")}
          action={
            <LinkButton href={`/klub/${encodeURIComponent(clubId)}`}>{tClub("back")}</LinkButton>
          }
        />
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

  const valid = isValidSubmission(sub);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}/kompas`}
          className="body inline-flex min-h-(--touch-target) items-center gap-1 self-start no-underline"
        >
          <Icon name="chevron-left" size={22} />
          {t("submission.back")}
        </Link>
        <p className="subheadline text-(--ink-muted)">
          {club.club.name} · {t("season", { season: sub.season })}
        </p>
        <h1 className="title-1">{t("submission.title")}</h1>
        <p className="footnote text-(--ink-muted)">
          {t("submission.meta", { date, season: sub.season })} · {t("submission.frozen")}
        </p>
        <div className="flex flex-wrap gap-2">
          {valid && sub.confirmedAt && (
            <Badge tone="success" dot>
              {t("confirm.confirmed", {
                date: sub.confirmedAt.toLocaleDateString("sk", {
                  dateStyle: "medium",
                  timeZone: "Europe/Bratislava",
                }),
              })}
            </Badge>
          )}
          {!valid && sub.withdrawnAt && <Badge tone="danger">{t("submit.withdrawn")}</Badge>}
        </div>
      </header>

      {!valid && sub.withdrawnAt && (
        <Alert tone="warning">
          {t("withdraw.withdrawn", {
            date: sub.withdrawnAt.toLocaleString("sk", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Bratislava",
            }),
          })}
        </Alert>
      )}

      {valid && canConfirm && (
        <Card variant="highlight" title={t("confirm.cardTitle")}>
          <ConfirmSubmission
            clubId={clubId}
            submissionId={sub.id}
            confirmed={Boolean(sub.confirmedAt)}
          />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-(--radius-md) bg-(--surface-raised) p-4">
          <span className="label text-(--ink-muted)">{t("submission.total")}</span>
          <span className="title-1 tabular-nums">
            {t("submission.points", { total: result.total })}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-(--radius-md) bg-(--surface-raised) p-4">
          <span className="label text-(--ink-muted)">{t("submission.filledLabel")}</span>
          <span className="title-1 tabular-nums">
            {t("submission.filledValue", { filled: result.filledAreas })}
          </span>
        </div>
      </div>

      <Accordion>
        {result.areas.map((a) => {
          const name = areas.find((x) => x.number === a.area)?.name ?? "";
          const hits = sub.questions.filter(
            (q) => checked.has(q.questionId) && q.questionId.startsWith(`${a.area}.`),
          );
          return (
            <AccordionItem
              key={a.area}
              title={
                <span className="flex items-center gap-3">
                  <span className="w-6 shrink-0 font-bold text-(--ink-muted)">{a.area}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="break-words">{name}</span>
                    <span className="footnote font-normal text-(--ink-muted)">
                      {a.points !== null
                        ? t("areaScore", { points: a.points })
                        : a.status === "few"
                          ? t("areaFew")
                          : t("areaEmpty")}
                    </span>
                  </span>
                  {a.band && (
                    <KompasBandBadge band={a.band}>{t(`bands.${a.band}`)}</KompasBandBadge>
                  )}
                </span>
              }
            >
              {hits.length > 0 ? (
                <>
                  <p className="label mb-1 text-(--ink-muted) uppercase">
                    {t("submission.checked")}
                  </p>
                  <ul className="callout list-disc space-y-1 pl-5">
                    {hits.map((q) => (
                      <li key={q.questionId}>{q.text}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="callout text-(--ink-muted)">{t("areaEmpty")}</p>
              )}
            </AccordionItem>
          );
        })}
      </Accordion>

      <Card title={t("submission.export")}>
        <CopyLine line={sub.line} />
      </Card>

      {valid && isAdmin(user) && <WithdrawSubmission clubId={clubId} submissionId={sub.id} />}
    </div>
  );
}

export default function SubmissionPage(
  props: PageProps<"/klub/[clubId]/kompas/odoslane/[submissionId]">,
) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Submission {...props} />
      </Suspense>
    </main>
  );
}
