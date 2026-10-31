import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Accordion, AccordionItem, Badge, EmptyState, Icon, LinkButton } from "@/components/sfz";
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
  visitViewMode,
} from "@/server/services/mentor-visit.service";

import { VisitContext } from "../visit-context";
import { VisitForm } from "../visit-form";
import { RatingsForm } from "../ratings-form";
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
        <EmptyState
          title={error.code === "FORBIDDEN" ? tClub("forbidden") : tClub("notFound")}
          action={<LinkButton href="/moja-akademia">{tClub("back")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  const visit = list.visits.find((v) => v.id === visitId);
  if (!visit) {
    return (
      <EmptyState
        title={t("notFound")}
        action={
          <LinkButton href={`/klub/${encodeURIComponent(clubId)}/mentoring#navstevy`}>
            {t("backToMentoring")}
          </LinkButton>
        }
      />
    );
  }
  const [club, areas] = await Promise.all([
    getClubOverview(visitDeps, user, clubId),
    listAreas(mongoContentStore, user),
  ]);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const mode = visitViewMode(list.access, visit.status);
  const data = mode.form ? await getVisitFormData(visitDeps, user, clubId) : null;
  // the reminder shows the visit before this one, not this one itself
  const context = data && data.previous?.id === visit.id ? { ...data, previous: null } : data;

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
        <h1 className="title-1">
          {t("visitOn", {
            date: format.dateTime(new Date(`${visit.date}T12:00:00Z`), { dateStyle: "long" }),
          })}
        </h1>
        <Badge
          tone={
            visit.status === "sent" ? "success" : visit.status === "planned" ? "info" : "neutral"
          }
          dot
          className="self-start"
        >
          {t(`status.${visit.status}`)}
        </Badge>
      </header>
      {(mode.checklist || !mode.form || visit.status === "planned") && (
        <VisitView
          visit={visit}
          members={new Map(list.members.map((m) => [m.userId, m.name]))}
          areaName={areaName}
          clubId={clubId}
          canTick={mode.checklist}
          today={isoToday()}
        />
      )}
      {mode.form && visit.status === "sent" && (visit.prepTask || visit.actions.length > 0) && (
        <RatingsForm
          key={visit.version}
          clubId={clubId}
          visitId={visit.id}
          version={visit.version}
          prep={
            visit.prepTask ? { text: visit.prepTask.text, rating: visit.prepTask.rating } : null
          }
          actions={visit.actions.map((a) => ({ id: a.id, text: a.text, rating: a.rating }))}
        />
      )}
      {mode.form && data && (
        <EditSection collapsed={mode.checklist} label={t("edit")}>
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
              topics: visit.topics,
              assessment: visit.assessment ?? { topics: [], overall: "" },
              prepTask: {
                text: visit.prepTask?.text ?? "",
                dueDate: visit.prepTask?.dueDate ?? null,
              },
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
        </EditSection>
      )}
    </div>
  );
}

/** The mentor's form: open for a draft, folded under the checklist once the visit is sent. */
function EditSection({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <Accordion>
      <AccordionItem title={label}>
        <div className="flex flex-col gap-6">{children}</div>
      </AccordionItem>
    </Accordion>
  );
}

export default function VisitPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Visit {...props} />
      </Suspense>
    </main>
  );
}
