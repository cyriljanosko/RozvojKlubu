import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ClubPin } from "@/components/favorites/club-pin";
import { Badge, Card, EmptyState, LinkButton, ProgressBar } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { planDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getClubPlan, summarizePlan } from "@/server/services/club-plan.service";
import { getClubOverview } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";

import { ConfirmPlan } from "./confirm-plan";
import { PlanBoard, type GoalCard } from "./plan-board";

export const metadata: Metadata = { title: defaultMessages.plan.pageTitle };

type Props = PageProps<"/klub/[clubId]/plan">;

async function Plan({ params, searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const query = await searchParams;
  // priority areas of the mentor's development focus (MC-c) replace the Kompas suggestion
  const focus =
    typeof query.oblasti === "string"
      ? [
          ...new Set(
            query.oblasti
              .split(",")
              .map(Number)
              .filter((n) => Number.isInteger(n) && n >= 1 && n <= 11),
          ),
        ].slice(0, 3)
      : [];
  const t = await getTranslations("plan");
  const tClub = await getTranslations("club");
  const format = await getFormatter();
  let view;
  try {
    view = await getClubPlan(planDeps, user, clubId);
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
  const [club, areas] = await Promise.all([
    getClubOverview(planDeps, user, clubId),
    listAreas(mongoContentStore, user),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const goals = view.plan?.goals ?? [];
  const summary = summarizePlan(view.plan);
  const date = (d: Date | string) =>
    format.dateTime(typeof d === "string" ? new Date(`${d}T12:00:00Z`) : new Date(d), {
      dateStyle: "medium",
    });
  // an empty plan offers goals in the focus areas (MC-c) or the weakest Kompas areas (21. 10. 2026)
  const suggestions = (focus.length > 0 ? focus : view.suggestions).slice(0, 3);
  const cards: GoalCard[] = goals.map((g) => ({
    id: g.id,
    area: g.area,
    title: g.title,
    publicText: g.publicText,
    indicator: g.indicator,
    owner: g.owner,
    ownerId: g.ownerId,
    dueDate: g.dueDate,
    status: g.status,
    meta: [
      g.owner,
      g.dueDate ? t("dueOn", { date: date(g.dueDate) }) : null,
      g.status === "done" && g.doneAt ? t("doneOn", { date: date(g.doneAt) }) : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const share = summary.goals > 0 ? (summary.done / summary.goals) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-1">
          <h1 className="title-1 min-w-0 flex-1">{t("headingShort")}</h1>
          <ClubPin user={user} kind="plan" clubId={clubId} clubName={club.club.name} />
        </div>
        <div className="flex flex-wrap gap-2">
          {view.plan?.confirmedAt && (
            <Badge tone="success" dot>
              {t("confirmedBadge", { date: date(view.plan.confirmedAt) })}
            </Badge>
          )}
          {summary.editedAfterConfirm && view.plan?.editedAt && (
            <Badge tone="warning">{t("editedAfter", { date: date(view.plan.editedAt) })}</Badge>
          )}
          <Badge tone="neutral">{t("seasonBadge", { season: view.season })}</Badge>
        </div>
        {summary.goals > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3">
              <span className="subheadline">
                {t("summary", { done: summary.done, goals: summary.goals })}
              </span>
              <span className="subheadline text-(--ink-muted)">{Math.round(share)} %</span>
            </div>
            <ProgressBar
              value={share}
              tone="success"
              label={t("summary", { done: summary.done, goals: summary.goals })}
            />
          </div>
        )}
        {view.access === "edit" &&
          summary.goals === 0 &&
          view.suggestions.length > 0 &&
          focus.length === 0 && (
            <p className="footnote text-(--ink-muted)">
              {t("suggested", {
                areas: view.suggestions.map((a) => `${a} ${areaName(a)}`).join(" · "),
              })}
            </p>
          )}
      </header>

      <PlanBoard
        clubId={clubId}
        version={view.plan?.version ?? 0}
        goals={cards}
        canEdit={view.access === "edit"}
        viewerId={view.viewerId}
        members={view.members}
        areas={areas.map((a) => ({ number: a.number, name: a.name }))}
        suggestions={suggestions}
      />

      {view.canConfirm && view.plan && goals.length > 0 && (
        <Card variant="highlight" title={t("confirmTitle")}>
          <div className="flex flex-col gap-3">
            <p className="callout">{t("confirmHint")}</p>
            <ConfirmPlan
              clubId={clubId}
              confirmed={view.plan.confirmedAt !== null}
              version={view.plan.version}
            />
          </div>
        </Card>
      )}
      <p className="footnote text-(--ink-muted)">{t("rights")}</p>
    </div>
  );
}

export default function PlanPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Plan {...props} />
      </Suspense>
    </main>
  );
}
