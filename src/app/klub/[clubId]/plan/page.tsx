import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { planDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getClubPlan, summarizePlan } from "@/server/services/club-plan.service";
import { getClubOverview } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";

import { ConfirmPlan } from "./confirm-plan";
import { GoalStatus } from "./goal-status";
import { PlanForm, type GoalValue } from "./plan-form";

export const metadata: Metadata = { title: defaultMessages.plan.pageTitle };

type Props = PageProps<"/klub/[clubId]/plan">;

const SUGGESTED = 2;

async function Plan({ params, searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const editRequested = (await searchParams).upravit === "1";
  const t = await getTranslations("plan");
  const tClub = await getTranslations("club");
  const format = await getFormatter();
  let view;
  try {
    view = await getClubPlan(planDeps, user, clubId);
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
  const [club, areas] = await Promise.all([
    getClubOverview(planDeps, user, clubId),
    listAreas(mongoContentStore, user),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const base = `/klub/${encodeURIComponent(clubId)}/plan`;
  const goals = view.plan?.goals ?? [];
  const editing = view.access === "edit" && (goals.length === 0 || editRequested);
  const summary = summarizePlan(view.plan);
  const date = (d: Date | string) =>
    format.dateTime(typeof d === "string" ? new Date(`${d}T12:00:00Z`) : new Date(d), {
      dateStyle: "medium",
    });

  // an empty plan offers 2 goals in the weakest Kompas areas (decision 21. 10. 2026)
  const blank = (area: number): GoalValue => ({
    area,
    title: "",
    publicText: "",
    indicator: "",
    owner: "",
    ownerId: null,
    dueDate: null,
    status: "todo",
  });
  const initial: GoalValue[] =
    goals.length > 0
      ? goals.map((g) => ({
          id: g.id,
          area: g.area,
          title: g.title,
          publicText: g.publicText,
          indicator: g.indicator,
          owner: g.owner,
          ownerId: g.ownerId,
          dueDate: g.dueDate,
          status: g.status,
        }))
      : Array.from({ length: SUGGESTED }, (_, i) =>
          blank(
            view.suggestions[i] ??
              areas.find((a) => !view.suggestions.includes(a.number))?.number ??
              1,
          ),
        );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {club.club.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading", { season: view.season })}
        </h1>
        {goals.length > 0 && !editing && (
          <p className="text-muted-foreground text-sm">
            {t("summary", { done: summary.done, goals: summary.goals })}
            {view.plan?.confirmedAt &&
              ` · ${t("confirmedOn", { date: date(view.plan.confirmedAt) })}`}
            {summary.editedAfterConfirm &&
              view.plan?.editedAt &&
              ` · ${t("editedAfter", { date: date(view.plan.editedAt) })}`}
          </p>
        )}
      </header>

      {editing ? (
        <>
          <p className="text-sm">{goals.length === 0 ? t("introNew") : t("introEdit")}</p>
          {goals.length === 0 && view.suggestions.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {t("suggested", {
                areas: view.suggestions.map((a) => `${a} ${areaName(a)}`).join(" · "),
              })}
            </p>
          )}
          <PlanForm
            clubId={clubId}
            version={view.plan?.version ?? 0}
            initial={initial}
            members={view.members}
            areas={areas.map((a) => ({ number: a.number, name: a.name }))}
            planHref={base}
          />
        </>
      ) : goals.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          {t("empty")}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {goals.map((g) => (
              <li key={g.id} className="flex flex-col gap-2 rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">
                  {g.area} · {areaName(g.area)}
                </p>
                <p className={`font-semibold ${g.status === "done" ? "line-through" : ""}`}>
                  {g.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {[
                    g.owner,
                    g.dueDate ? t("dueOn", { date: date(g.dueDate) }) : null,
                    g.status === "done" && g.doneAt ? t("doneOn", { date: date(g.doneAt) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {g.indicator && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t("indicator")}: </span>
                    {g.indicator}
                  </p>
                )}
                <p className="bg-muted/50 rounded-md px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">{t("publicShort")}: </span>
                  {g.publicText}
                </p>
                {view.access === "edit" || g.ownerId === view.viewerId ? (
                  <GoalStatus
                    key={`${g.id}-${view.plan?.version}`}
                    clubId={clubId}
                    goalId={g.id}
                    status={g.status}
                    version={view.plan?.version ?? 0}
                  />
                ) : (
                  <p className="text-xs">
                    <span className="rounded-full border px-2 py-0.5">
                      {t(`status.${g.status}`)}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-start gap-3">
            {view.access === "edit" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`${base}?upravit=1`}>{t("edit")}</Link>
              </Button>
            )}
            {view.canConfirm && view.plan && (
              <ConfirmPlan
                clubId={clubId}
                confirmed={view.plan.confirmedAt !== null}
                version={view.plan.version}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PlanPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Plan {...props} />
      </Suspense>
    </main>
  );
}
