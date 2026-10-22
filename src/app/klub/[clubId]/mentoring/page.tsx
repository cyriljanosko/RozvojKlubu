import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { PrintButton } from "@/components/analytics/panel-board";
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
import { getClubOverview } from "@/server/services/clubs.service";
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
        <p className="text-sm">{error.code === "FORBIDDEN" ? t("forbidden") : tClub("notFound")}</p>
      );
    }
    throw error;
  }
  const [club, areas, members, visits] = await Promise.all([
    getClubOverview(mentoringDeps, user, clubId),
    listAreas(mongoContentStore, user),
    clubMembers(mentoringDeps, clubId),
    listMentorVisits(visitDeps, user, clubId),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const base = `/klub/${encodeURIComponent(clubId)}`;
  const mentors = members.filter((m) => m.roles.includes("mentor")).map((m) => m.name);
  const seasonVisits = visits.visits
    .filter((v) => v.season === view.season && v.status !== "withdrawn" && v.status !== "draft")
    .sort((a, b) => a.date.localeCompare(b.date));
  const date = (d: Date | string) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const isoDate = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: "medium" });

  const texts = (part: MentoringPartKey, record: Record<string, unknown> | null) =>
    record ? (
      <dl className="flex flex-col gap-2 text-sm">
        {FIELDS[part]
          .filter((f) => typeof record[f.key] === "string" && (record[f.key] as string).trim())
          .map((f) => (
            <div key={f.key}>
              <dt className="text-muted-foreground text-xs">{t(`fields.${f.label}`)}</dt>
              <dd className="whitespace-pre-wrap">{record[f.key] as string}</dd>
            </div>
          ))}
      </dl>
    ) : null;

  const part = (key: MentoringPartKey, extra?: ReactNode) => {
    const record = view[key] as (Record<string, unknown> & { savedAt: Date }) | null;
    const writes = view.writes.includes(key);
    return (
      <section
        key={key}
        className="flex flex-col gap-3 rounded-xl border p-4 print:break-inside-avoid"
      >
        <div>
          <h2 className="font-semibold">{t(`parts.${key}.title`)}</h2>
          <p className="text-muted-foreground text-xs">
            {record
              ? t("savedOn", { date: date(record.savedAt) })
              : `${t(`parts.${key}.who`)} ${
                  CLUB_PARTS.includes(key) ? t("waitsClub") : t("waitsMentor")
                }`}
          </p>
        </div>
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
      </section>
    );
  };

  const focusAreas = view.focus?.areas ?? [];
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link href={base} className="text-muted-foreground text-sm underline underline-offset-4">
          {club.club.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading", { season: view.season })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {mentors.length > 0 ? t("mentor", { names: mentors.join(", ") }) : t("noMentor")}
        </p>
        <p className="text-sm print:hidden">{t("intro")}</p>
        {view.writes.length === 0 && view.role !== "coach" && (
          <p className="text-muted-foreground text-xs">{t("pastSeason")}</p>
        )}
        <p className="text-muted-foreground hidden text-xs print:block">
          {t("printed", { date: format.dateTime(new Date(), { dateStyle: "medium" }) })}
        </p>
        <div className="mt-1 print:hidden">
          <PrintButton label={t("print")} />
        </div>
      </header>

      {part("intro")}
      {part(
        "focus",
        focusAreas.length > 0 ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex flex-wrap gap-1.5">
              {focusAreas.map((n) => (
                <span key={n} className="bg-primary/10 rounded-full px-2.5 py-0.5 text-xs">
                  {n} · {areaName(n)}
                </span>
              ))}
            </p>
            {view.role !== "coach" && (
              <Link
                href={`${base}/plan?oblasti=${focusAreas.join(",")}`}
                className="self-start text-xs underline underline-offset-4 print:hidden"
              >
                {t("toPlan")}
              </Link>
            )}
          </div>
        ) : null,
      )}

      <section className="flex flex-col gap-3 rounded-xl border p-4 print:break-inside-avoid">
        <div>
          <h2 className="font-semibold">{t("parts.visits.title")}</h2>
          <p className="text-muted-foreground text-xs">{t("parts.visits.who")}</p>
        </div>
        {seasonVisits.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("visits.none")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {seasonVisits.map((v) => {
              const rated = v.actions.filter((a) => a.rating);
              const count = (r: string) => rated.filter((a) => a.rating === r).length;
              return (
                <li key={v.id}>
                  <Link
                    href={`${base}/navstevy/${v.id}`}
                    className="hover:bg-muted/50 flex flex-col gap-0.5 rounded-lg border p-3 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{isoDate(v.date)}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs">
                        {tVisits(`status.${v.status}`)}
                      </span>
                    </span>
                    {v.topics.length > 0 && (
                      <span className="text-xs">
                        {tVisits("topics", {
                          areas: v.topics.map((n) => `${n} ${areaName(n)}`).join(" · "),
                        })}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">
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
                    {v.assessment?.overall && (
                      <span className="text-muted-foreground line-clamp-2 text-xs">
                        {v.assessment.overall}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm print:hidden">
          {visits.access === "write" && (
            <Link
              href={`${base}/navstevy/nova`}
              className="font-medium underline underline-offset-4"
            >
              {t("visits.plan")}
            </Link>
          )}
          <Link href={`${base}/navstevy`} className="underline underline-offset-4">
            {t("visits.all")}
          </Link>
        </div>
      </section>

      {part("closingClub")}
      {part("closingMentor")}
    </div>
  );
}

export default function MentoringPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Mentoring {...props} />
      </Suspense>
    </main>
  );
}
