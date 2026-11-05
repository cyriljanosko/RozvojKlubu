import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NEWS_KIND_TONE, NEWS_STATUS_TONE } from "@/components/news/news-items";
import { Alert, Badge, Button, EmptyState, Icon, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { listClubNews } from "@/server/services/news.service";

import { createClubNewsAction } from "./actions";

export const metadata: Metadata = { title: defaultMessages.clubNews.title };

type Props = PageProps<"/klub/[clubId]/novinky">;

/** "Moje návrhy" – the club's Novinky proposals (ADR 0023, design ZK approved 31. 10. 2026). */
async function ClubNews({ params }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const clubId = decodeURIComponent((await params).clubId);
  const [t, tNews, format] = await Promise.all([
    getTranslations("clubNews"),
    getTranslations("news"),
    getFormatter(),
  ]);
  let list;
  try {
    list = await listClubNews(newsDeps, user, clubId);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return <EmptyState title={t("forbidden")} />;
    }
    throw error;
  }
  const base = `/klub/${encodeURIComponent(clubId)}/novinky`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-1">{t("title")}</h1>
        <p className="body text-(--ink-muted)">{t("lead")}</p>
      </header>

      {list.canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={createClubNewsAction.bind(null, clubId, "story")}>
            <Button type="submit" icon="edit" block>
              {t("newStory")}
            </Button>
          </form>
          <form action={createClubNewsAction.bind(null, clubId, "tip")}>
            <Button type="submit" variant="secondary" block>
              {t("newTip")}
            </Button>
          </form>
        </div>
      ) : (
        <Alert tone="info">{t("readOnly")}</Alert>
      )}

      <section aria-labelledby="club-news-mine" className="flex flex-col gap-3">
        <h2 id="club-news-mine" className="title-3">
          {t("mine")}
        </h2>
        {list.items.length === 0 ? (
          <p className="subheadline text-(--ink-muted)">{t("empty")}</p>
        ) : (
          <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
            {list.items.map((item) => (
              <li key={item.id} className="border-b border-(--hairline) last:border-b-0">
                <Link
                  href={`${base}/${item.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 text-(--ink) no-underline"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={NEWS_STATUS_TONE[item.status]} dot>
                        {t(`status.${item.status}`)}
                      </Badge>
                      <Badge tone={NEWS_KIND_TONE[item.kind]}>{tNews(`kind.${item.kind}`)}</Badge>
                    </span>
                    <span className="headline break-words">{item.title || t("untitled")}</span>
                    {item.status === "returned" && item.reviewNote ? (
                      <span className="footnote text-(--danger-ink)">{item.reviewNote}</span>
                    ) : (
                      <span className="footnote text-(--ink-muted)">
                        {t("updated", {
                          date: format.dateTime(new Date(item.updatedAt), { dateStyle: "medium" }),
                        })}
                      </span>
                    )}
                  </span>
                  <Icon name="chevron-right" size={18} aria-hidden className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LinkButton href="/novinky" variant="tertiary">
        {tNews("title")}
      </LinkButton>
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <ClubNews {...props} />
    </Suspense>
  );
}
