import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NEWS_KIND_TONE, NEWS_STATUS_TONE } from "@/components/news/news-items";
import { Badge, Button, EmptyState, Icon, LinkTabs } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import type { NewsStatus } from "@/server/db/types";
import { isAdmin } from "@/server/services/club-access";
import { listAdminNews } from "@/server/services/news.service";

import { createAcademyNewsAction } from "./actions";

export const metadata: Metadata = { title: defaultMessages.adminNews.title };

type Props = PageProps<"/admin/novinky">;

const TABS: NewsStatus[] = ["submitted", "returned", "published", "draft", "hidden"];

/** Administrácia → Novinky (ADR 0023, design ZK approved 31. 10. 2026): queues by state. */
async function AdminNews({ searchParams }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const [t, tNews, tStatus, format] = await Promise.all([
    getTranslations("adminNews"),
    getTranslations("news"),
    getTranslations("clubNews.status"),
    getFormatter(),
  ]);
  if (!isAdmin(user)) return <EmptyState title={t("forbidden")} />;
  const q = await searchParams;
  const status = TABS.includes(q.status as NewsStatus) ? (q.status as NewsStatus) : "submitted";
  const [items, all] = await Promise.all([
    listAdminNews(newsDeps, user, { status }),
    listAdminNews(newsDeps, user, {}),
  ]);
  const count = (s: NewsStatus) => all.filter((p) => p.status === s).length;
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="title-1">{t("title")}</h1>
          <p className="subheadline text-(--ink-muted)">{t("lead")}</p>
        </div>
        <form action={createAcademyNewsAction}>
          <Button type="submit" icon="plus">
            {t("new")}
          </Button>
        </form>
      </header>

      <div className="overflow-x-auto">
        <LinkTabs
          navLabel={t("title")}
          active={status}
          items={TABS.map((s) => {
            const n = count(s);
            return {
              id: s,
              label: n > 0 ? `${t(`tabs.${s}`)} (${n})` : t(`tabs.${s}`),
              href: `/admin/novinky?status=${s}`,
            };
          })}
        />
      </div>

      {items.length === 0 ? (
        <p className="subheadline text-(--ink-muted)">{t("empty")}</p>
      ) : (
        <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
          {items.map((item) => (
            <li key={item.id} className="border-b border-(--hairline) last:border-b-0">
              <Link
                href={`/admin/novinky/${item.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 text-(--ink) no-underline"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={NEWS_KIND_TONE[item.kind]}>{tNews(`kind.${item.kind}`)}</Badge>
                    {item.awaitsConfirmation && (
                      <Badge tone="warning" dot>
                        {t("awaits")}
                      </Badge>
                    )}
                    {item.pinned && <Badge tone="brand">{tNews("pinned")}</Badge>}
                  </span>
                  <span className="headline break-words">{item.title || tStatus("draft")}</span>
                  <span className="footnote text-(--ink-muted)">
                    {[
                      item.club?.name ?? tNews("sfz"),
                      item.status === "published"
                        ? t("publishedAt", { date: date(item.publishedAt) })
                        : item.submittedAt
                          ? t("submittedAt", { date: date(item.submittedAt) })
                          : null,
                      item.status === "published" ? t("views", { count: item.views }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Badge tone={NEWS_STATUS_TONE[item.status]} className="shrink-0">
                  {item.status === "submitted" ? t("review") : t("edit")}
                </Badge>
                <Icon name="chevron-right" size={18} aria-hidden className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <AdminNews {...props} />
    </Suspense>
  );
}
