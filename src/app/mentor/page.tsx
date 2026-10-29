import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { TaskList } from "@/components/academy/task-list";
import { Avatar, Badge, EmptyState, Icon, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { academyDeps, submissionDeps } from "@/server/clubs/deps";
import { getMyAcademy, type AcademyView } from "@/server/services/academy.service";
import { listMentorClubs } from "@/server/services/kompas-submission.service";

export const metadata: Metadata = { title: defaultMessages.mentor.title };

type MentorRow = NonNullable<AcademyView["mentor"]>["rows"][number];
type AdminRow = NonNullable<AcademyView["admin"]>["rows"][number];
type Tone = "danger" | "warning" | "success" | "info";

const isoDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("sk", {
    ...opts,
    timeZone: "Europe/Bratislava",
  });
const date = (d: Date) =>
  d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

/** One state per club for the list, most urgent first (design "Pracovisko mentora"). */
function stateOf(
  row: { latest: { confirmedAt?: Date | null } | null },
  status: MentorRow | AdminRow | undefined,
): { key: string; tone: Tone } {
  if (!row.latest) return { key: "noKompas", tone: "danger" };
  if (!row.latest.confirmedAt) return { key: "kompasToConfirm", tone: "warning" };
  if (status && "plan" in status && status.plan.goals > 0 && !status.plan.confirmed)
    return { key: "planToConfirm", tone: "warning" };
  if (status && status.visits.overdue > 0) return { key: "overdue", tone: "warning" };
  return { key: "ok", tone: "success" };
}

/** Mentor's workspace (R4 G3c): clubs of the season, what waits for confirmation, next visits. */
async function Mentor() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  // the service decides: a mentor sees their clubs of the season, admin_sfz all clubs
  const t = await getTranslations("mentor");

  let rows;
  try {
    rows = await listMentorClubs(submissionDeps, user);
  } catch (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") {
      return (
        <EmptyState
          title={t("forbidden")}
          action={<LinkButton href="/moja-akademia">{t("back")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  // statuses of the season (visits, plan, mentoring) from the academy view
  const view = await getMyAcademy(academyDeps, user).catch(() => null);
  const statusOf = (clubId: string): MentorRow | AdminRow | undefined =>
    view?.mentor?.rows.find((r) => r.clubId === clubId) ??
    view?.admin?.rows.find((r) => r.clubId === clubId);

  const kompasToConfirm = rows.filter((r) => r.latest && !r.latest.confirmedAt);
  const plansToConfirm = rows.flatMap((r) => {
    const s = statusOf(r.clubId);
    return s && "plan" in s && s.plan.goals > 0 && (!s.plan.confirmed || s.plan.editedAfterConfirm)
      ? [{ row: r, edited: s.plan.editedAfterConfirm }]
      : [];
  });
  const visits = rows
    .flatMap((r) => {
      const next = statusOf(r.clubId)?.visits.nextPlanned;
      return next ? [{ row: r, date: next }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const base = (clubId: string) => `/klub/${encodeURIComponent(clubId)}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="subheadline text-(--ink-muted)">
          {t("season", { season: view?.season ?? "" })}
        </p>
        <h1 className="large-title">{t("titleShort")}</h1>
        <p className="callout text-(--ink-muted)">{t("intro")}</p>
      </header>

      <section className="grid grid-cols-3 gap-2" aria-label={t("stats.label")}>
        <Stat value={rows.length} label={t("stats.clubs")} />
        <Stat
          value={kompasToConfirm.length + plansToConfirm.length}
          label={t("stats.toConfirm")}
          highlight
        />
        <Stat value={visits.length} label={t("stats.visits")} />
      </section>

      {view?.mentor && view.mentor.tasks.length > 0 && (
        <TaskList title={t("tasks")} tasks={view.mentor.tasks} />
      )}

      {(kompasToConfirm.length > 0 || plansToConfirm.length > 0) && (
        <section className="flex flex-col gap-2" aria-labelledby="to-confirm">
          <h2 id="to-confirm" className="title-3">
            {t("toConfirm")}
          </h2>
          <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
            {kompasToConfirm.map((r) => (
              <Row
                key={`k-${r.clubId}`}
                href={`${base(r.clubId)}/kompas/odoslane/${r.latest!.id}`}
                icon="check-circle"
                title={t("kompasOf", { club: r.name })}
                detail={t("sentOn", { date: date(r.latest!.submittedAt) })}
              />
            ))}
            {plansToConfirm.map(({ row, edited }) => (
              <Row
                key={`p-${row.clubId}`}
                href={`${base(row.clubId)}/plan`}
                icon="file-text"
                title={t("planOf", { club: row.name })}
                detail={edited ? t("planEdited") : t("planNotConfirmed")}
              />
            ))}
          </ul>
        </section>
      )}

      {visits.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="next-visits">
          <h2 id="next-visits" className="title-3">
            {t("nextVisits")}
          </h2>
          <ul className="flex flex-col gap-2">
            {visits.map(({ row, date: d }) => (
              <li key={row.clubId}>
                <Link
                  href={`${base(row.clubId)}/mentoring#navstevy`}
                  className="flex items-center gap-3 rounded-(--radius-md) bg-(--surface-raised) px-4 py-3 text-(--ink) no-underline"
                >
                  <span className="flex w-13 shrink-0 flex-col items-center rounded-(--radius-sm) bg-(--surface) py-1.5">
                    <span className="caption-2 text-(--brand-blue-ink) uppercase">
                      {isoDate(d, { month: "short" })}
                    </span>
                    <span className="title-3">{isoDate(d, { day: "numeric" })}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="headline break-words">{row.name}</span>
                    <span className="footnote text-(--ink-muted)">{row.union}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="clubs">
        <h2 id="clubs" className="title-3">
          {t("clubs")}
        </h2>
        <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
          {rows.map((r) => {
            const state = stateOf(r, statusOf(r.clubId));
            return (
              <li key={r.clubId} className="border-t border-(--hairline) first:border-t-0">
                <Link
                  href={base(r.clubId)}
                  className="flex min-h-15 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
                >
                  <Avatar name={r.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="body break-words">{r.name}</span>
                    <span className="footnote text-(--ink-muted)">
                      {r.union}
                      {r.latest &&
                        ` · ${t("latest", {
                          date: date(r.latest.submittedAt),
                          total: r.latest.total,
                          filled: r.latest.filledAreas,
                        })}`}
                    </span>
                  </span>
                  <Badge tone={state.tone} dot className="shrink-0">
                    {t(`state.${state.key}`)}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "flex flex-col gap-0.5 rounded-(--radius-md) bg-(--brand-blue-tint) p-3 text-(--brand-blue-ink)"
          : "flex flex-col gap-0.5 rounded-(--radius-md) bg-(--surface-raised) p-3"
      }
    >
      <span className="title-2 tabular-nums">{value}</span>
      <span className={highlight ? "footnote" : "footnote text-(--ink-muted)"}>{label}</span>
    </div>
  );
}

function Row({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="border-t border-(--hairline) first:border-t-0">
      <Link
        href={href}
        className="flex min-h-15 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
      >
        <span className="text-(--brand-blue-ink)" aria-hidden>
          <Icon name={icon} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="body break-words">{title}</span>
          <span className="footnote text-(--ink-muted)">{detail}</span>
        </span>
        <span className="text-(--ink-muted)" aria-hidden>
          <Icon name="chevron-right" size={18} />
        </span>
      </Link>
    </li>
  );
}

export default function MentorPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Mentor />
      </Suspense>
    </main>
  );
}
