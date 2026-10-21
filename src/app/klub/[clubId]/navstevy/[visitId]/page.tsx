import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getClubOverview } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";
import {
  getVisitFormData,
  isoToday,
  listMentorVisits,
} from "@/server/services/mentor-visit.service";

import { VisitContext } from "../visit-context";
import { VisitForm } from "../visit-form";
import { VisitView } from "../visit-view";

export const metadata: Metadata = { title: defaultMessages.visits.title };

type Props = PageProps<"/klub/[clubId]/navstevy/[visitId]">;

async function Visit({ params }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const { clubId: rawId, visitId } = await params;
  const clubId = decodeURIComponent(rawId);
  const t = await getTranslations("visits");
  const tClub = await getTranslations("club");
  const format = await getFormatter();
  let list;
  try {
    list = await listMentorVisits(visitDeps, user, clubId);
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
  const visit = list.visits.find((v) => v.id === visitId);
  if (!visit) return <p className="text-sm">{t("notFound")}</p>;
  const [club, areas] = await Promise.all([
    getClubOverview(visitDeps, user, clubId),
    listAreas(mongoContentStore, user),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const editable = list.access === "write" && visit.status !== "withdrawn";
  const data = editable ? await getVisitFormData(visitDeps, user, clubId) : null;
  // the reminder shows the visit before this one, not this one itself
  const context = data && data.previous?.id === visit.id ? { ...data, previous: null } : data;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}/navstevy`}
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {club.club.name} · {t("title")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("visitOn", {
            date: format.dateTime(new Date(`${visit.date}T12:00:00Z`), { dateStyle: "long" }),
          })}
        </h1>
        <p className="text-sm">
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {t(`status.${visit.status}`)}
          </span>
        </p>
      </header>
      {editable && data ? (
        <>
          {context && <VisitContext data={context} areaName={areaName} />}
          <VisitForm
            clubId={clubId}
            visitId={visit.id}
            status={visit.status}
            version={visit.version}
            initial={{
              date: visit.date,
              form: visit.form,
              participantIds: visit.participantIds,
              participants: visit.participants,
              summary: visit.summary,
              findings: visit.findings,
              actions: visit.actions.map(({ id, text, area, owner, ownerId, dueDate }) => ({
                id,
                text,
                area,
                owner,
                ownerId,
                dueDate,
              })),
            }}
            members={data.members}
            areas={areas.map((a) => ({ number: a.number, name: a.name }))}
          />
        </>
      ) : (
        <VisitView
          visit={visit}
          members={new Map(list.members.map((m) => [m.userId, m.name]))}
          areaName={areaName}
          clubId={clubId}
          canTick={list.access === "club"}
          today={isoToday()}
        />
      )}
    </div>
  );
}

export default function VisitPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Visit {...props} />
      </Suspense>
    </main>
  );
}
