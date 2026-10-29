import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { PrintButton } from "@/components/analytics/panel-board";
import { Alert, Avatar, Badge, Card, EmptyState, LinkButton, Stepper } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { mentoringDeps, visitDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import {
  getClubMentoring,
  type MentoringPartKey,
  type MentoringView,
} from "@/server/services/club-mentoring.service";
import { listAreas } from "@/server/services/content.service";
import { clubMembers, listMentorVisits } from "@/server/services/mentor-visit.service";

import { PartForm, type PartField } from "./part-form";

export const metadata: Metadata = { title: defaultMessages.mentoring.title };

type Props = PageProps<"/klub/[clubId]/mentoring">;

/** Fields of each part: value key and message key (label / placeholder). */
const FIELDS: Record<MentoringPartKey, PartField[]> = {
  intro: [
    { key: "strengths", label: "strengths" },
    { key: "weaknesses", label: "weaknesses" },
    { key: "improve", label: "improve" },
    { key: "expectations", label: "expectations" },
  ],
  focus: [
    { key: "strengths", label: "strengths" },
    { key: "weaknesses", label: "weaknesses" },
    { key: "recommendations", label: "recommendations" },
    { key: "assessment", label: "assessment" },
  ],
  closingClub: [
    { key: "stepsReview", label: "stepsReview" },
    { key: "selfAssessment", label: "selfAssessment" },
    { key: "feedback", label: "feedback", hint: "feedbackHint" },
  ],
  closingMentor: [
    { key: "assessment", label: "closingAssessment" },
    { key: "nextPlan", label: "nextPlan" },
  ],
};

/** who fills the part – for "waits for …" */
const CLUB_PARTS: MentoringPartKey[] = ["intro", "closingClub"];

async function Mentoring({ params, searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const q = await searchParams;
  const t = await getTranslations("mentoring");
  const tVisits = await getTranslations("visits");
  const tClub = await getTranslations("club");
  const format = await getFormatter();
  let view: MentoringView;
  try {
    view = await getClubMentoring(
      mentoringDeps,
      user,
      clubId,
      typeof q.season === "string" ? q.season : null,
    );
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <EmptyState
          title={error.code === "FORBIDDEN" ? t("forbidden") : tClub("notFound")}
          action={<LinkButton href="/moja-akademia">{tClub("back")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  const [areas, members, visits] = await Promise.all([
    listAreas(mongoContentStore, user),
    clubMembers(mentoringDeps, clubId),
    listMentorVisits(visitDeps, user, clubId),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const base = `/klub/${encodeURIComponent(clubId)}`;
  const mentors = members.filter((m) => m.roles.includes("mentor")).map((m) => m.name);
  // the visits list now lives here (decision 29. 10. 2026): the mentor also sees drafts
  const seasonVisits = visits.visits
    .filter(
      (v) =>
        v.season === view.season &&
        v.status !== "withdrawn" &&
        (v.status !== "draft" || visits.access === "write"),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const date = (d: Date | string) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const isoDate = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: "medium" });

  const texts = (part: MentoringPartKey, record: Record<string, unknown> | null) =>
    record ? (
      <dl className="flex flex-col gap-2">
        {FIELDS[part]
          .filter((f) => typeof record[f.key] === "string" && (record[f.key] as string).trim())
          .map((f) => (
            <div key={f.key}>
              <dt className="footnote text-(--ink-muted)">{t(`fields.${f.label}`)}</dt>
              <dd className="callout whitespace-pre-wrap">{record[f.key] as string}</dd>
            </div>
          ))}
      </dl>
    ) : null;

  const part = (key: MentoringPartKey, extra?: ReactNode) => {
    const record = view[key] as (Record<string, unknown> & { savedAt: Date }) | null;
    const writes = view.writes.includes(key);
    return (
      <Card
        key={key}
        title={t(`parts.${key}.title`)}
        action={
          record ? (
            <Badge tone="success" dot>
              {t("done")}
            </Badge>
          ) : undefined
        }
        className="print:break-inside-avoid"
      >
        <div className="flex flex-col gap-3">
          <p className="footnote text-(--ink-muted)">
            {record
              ? t("savedOn", { date: date(record.savedAt) })
              : `${t(`parts.${key}.who`)} ${
                  CLUB_PARTS.includes(key) ? t("waitsClub") : t("waitsMentor")
                }`}
          </p>
          {texts(key, record)}
          {extra}
          {writes && (
            <PartForm
              key={`${key}-${view.version}`}
              clubId={clubId}
              part={key}
              fields={FIELDS[key]}
              filled={record !== null}
              startOpen={
                (key === "intro" && view.role === "management") ||
                (key === "focus" && view.role === "mentor")
              }
              version={view.version}
              initial={Object.fromEntries(
                FIELDS[key].map((f) => [
                  f.key,
                  typeof record?.[f.key] === "string" ? (record[f.key] as string) : "",
                ]),
              )}
              areas={
                key === "focus"
                  ? {
                      options: areas.map((a) => ({ number: a.number, name: a.name })),
                      chosen: view.focus?.areas ?? [],
                    }
                  : undefined
              }
            />
          )}
        </div>
      </Card>
    );
  };

  const focusAreas = view.focus?.areas ?? [];
  const sent = seasonVisits.filter((v) => v.status === "sent").length;
  const steps = [
    {
      label: t("steps.intro"),
      description: view.intro ? t("steps.done") : t("steps.introWho"),
      done: Boolean(view.intro),
    },
    {
      label: t("steps.focus"),
      description: view.focus
        ? t("steps.focusAreas", { count: focusAreas.length })
        : t("steps.focusWho"),
      done: Boolean(view.focus),
    },
    {
      label: t("steps.visits"),
      description: t("steps.visitsCount", { count: sent }),
      done: sent > 0,
    },
    {
      label: t("steps.closing"),
      description:
        view.closingClub && view.closingMentor ? t("steps.done") : t("steps.closingWhen"),
      done: Boolean(view.closingClub && view.closingMentor),
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  const visitStatusTone = { draft: "neutral", planned: "info", sent: "success" } as const;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h1 className="title-1 min-w-0 flex-1">{t("headingShort", { season: view.season })}</h1>
          <span className="print:hidden">
            <PrintButton label={t("print")} />
          </span>
        </div>
        {mentors.length > 0 ? (
          <span className="flex items-center gap-2">
            <Avatar name={mentors[0]} size="sm" />
            <span className="subheadline text-(--ink-muted)">
              {t("mentor", { names: mentors.join(", ") })}
            </span>
          </span>
        ) : (
          <p className="subheadline text-(--ink-muted)">{t("noMentor")}</p>
        )}
        <p className="callout text-(--ink-muted) print:hidden">{t("intro")}</p>
        {view.writes.length === 0 && view.role !== "coach" && (
          <Alert tone="info">{t("pastSeason")}</Alert>
        )}
        <p className="footnote hidden text-(--ink-muted) print:block">
          {t("printed", { date: format.dateTime(new Date(), { dateStyle: "medium" }) })}
        </p>
      </header>

      <Card title={t("stepsTitle")} className="print:hidden">
        <Stepper
          orientation="vertical"
          current={current === -1 ? steps.length : current}
          steps={steps.map(({ label, description }) => ({ label, description }))}
        />
      </Card>

      {part("intro")}
      {part(
        "focus",
        focusAreas.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap gap-2">
              {focusAreas.map((n) => (
                <Badge key={n} tone="brand">
                  {n} · {areaName(n)}
                </Badge>
              ))}
            </p>
            {view.role !== "coach" && (
              <Link
                href={`${base}/plan?oblasti=${focusAreas.join(",")}`}
                className="subheadline self-start print:hidden"
              >
                {t("toPlan")}
              </Link>
            )}
          </div>
        ) : null,
      )}

      <section
        id="navstevy"
        className="flex scroll-mt-20 flex-col gap-2 print:break-inside-avoid"
        aria-labelledby="visits-title"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="visits-title" className="title-3">
            {t("parts.visits.title")}
          </h2>
          {visits.access === "write" && (
            <span className="print:hidden">
              <LinkButton href={`${base}/navstevy/nova`} variant="secondary" size="sm" icon="plus">
                {t("visits.new")}
              </LinkButton>
            </span>
          )}
        </div>
        {seasonVisits.length === 0 ? (
          <p className="callout rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink-muted)">
            {t("visits.none")}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {seasonVisits.map((v) => {
              const rated = v.actions.filter((a) => a.rating);
              const count = (r: string) => rated.filter((a) => a.rating === r).length;
              return (
                <li key={v.id}>
                  <Link
                    href={`${base}/navstevy/${v.id}`}
                    className="flex flex-col gap-1.5 rounded-(--radius-md) bg-(--surface-raised) px-4 py-3.5 text-(--ink) no-underline"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="headline">{isoDate(v.date)}</span>
                      <Badge
                        tone={
                          visitStatusTone[v.status as keyof typeof visitStatusTone] ?? "neutral"
                        }
                        dot
                      >
                        {tVisits(`status.${v.status}`)}
                      </Badge>
                    </span>
                    <span className="footnote text-(--ink-muted)">
                      {[
                        tVisits(`form.forms.${v.form}`),
                        v.topics.length > 0
                          ? v.topics.map((n) => `${n} ${areaName(n)}`).join(" · ")
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {(v.actions.length > 0 || v.prepTask || rated.length > 0) && (
                      <span className="footnote">
                        {[
                          v.actions.length > 0
                            ? t("visits.steps", {
                                done: v.actions.filter((a) => a.done).length,
                                total: v.actions.length,
                              })
                            : null,
                          v.prepTask?.rating
                            ? t("visits.prep", {
                                rating: tVisits(`ratings.values.${v.prepTask.rating}`),
                              })
                            : v.prepTask?.text
                              ? t("visits.prepText", { text: v.prepTask.text })
                              : null,
                          rated.length > 0
                            ? t("visits.rated", {
                                done: count("done"),
                                partial: count("partial"),
                                not: count("not"),
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {v.assessment?.overall && (
                      <span className="footnote line-clamp-2 text-(--ink-muted)">
                        {v.assessment.overall}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        <p className="footnote text-(--ink-muted)">{t("visits.who")}</p>
      </section>

      {part("closingClub")}
      {part("closingMentor")}
    </div>
  );
}

export default function MentoringPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Mentoring {...props} />
      </Suspense>
    </main>
  );
}
