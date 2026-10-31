import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EmptyState, Icon, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { visitDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getClubOverview } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";
import { getVisitFormData } from "@/server/services/mentor-visit.service";

import { VisitContext } from "../visit-context";
import { VisitForm } from "../visit-form";

export const metadata: Metadata = { title: defaultMessages.visits.newTitle };

async function NewVisit({ params }: PageProps<"/klub/[clubId]/navstevy/nova">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const t = await getTranslations("visits");
  const tClub = await getTranslations("club");
  let data;
  try {
    data = await getVisitFormData(visitDeps, user, clubId);
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
    getClubOverview(visitDeps, user, clubId),
    listAreas(mongoContentStore, user),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bratislava" });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link
          href={`/klub/${encodeURIComponent(clubId)}/mentoring#navstevy`}
          className="body inline-flex min-h-(--touch-target) items-center gap-1 self-start no-underline"
        >
          <Icon name="chevron-left" size={22} />
          {t("backToMentoring")}
        </Link>
        <p className="subheadline text-(--ink-muted)">{club.club.name}</p>
        <h1 className="title-1">{t("newTitle")}</h1>
        <p className="text-sm text-(--ink-muted)">{t("season", { season: data.season })}</p>
      </header>
      <VisitContext data={data} areaName={areaName} />
      <VisitForm
        clubId={clubId}
        visitId={null}
        status={null}
        version={0}
        initial={{
          date: today,
          form: "onsite",
          participantIds: [],
          participants: "",
          summary: "",
          topics: [],
          assessment: { topics: [], overall: "" },
          prepTask: { text: "", dueDate: null },
          findings: [],
          actions: [],
        }}
        members={data.members}
        areas={areas.map((a) => ({ number: a.number, name: a.name }))}
      />
    </div>
  );
}

export default function NewVisitPage(props: PageProps<"/klub/[clubId]/navstevy/nova">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <NewVisit {...props} />
      </Suspense>
    </main>
  );
}
