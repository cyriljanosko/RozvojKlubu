import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NEWS_KIND_TONE, NEWS_STATUS_TONE } from "@/components/news/news-items";
import { Badge, Card, EmptyState, Icon, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { getEnv } from "@/server/env";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { getAdminNews } from "@/server/services/news.service";

import { NewsReview } from "./news-review";

export const metadata: Metadata = { title: defaultMessages.adminNews.title };

type Props = PageProps<"/admin/novinky/[newsId]">;

async function AdminNewsDetail({ params }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const [t, tNews, tStatus, tE, format] = await Promise.all([
    getTranslations("adminNews"),
    getTranslations("news"),
    getTranslations("clubNews.status"),
    getTranslations("newsEditor"),
    getFormatter(),
  ]);
  if (!isAdmin(user)) return <EmptyState title={t("forbidden")} />;
  const { newsId } = await params;
  let post;
  try {
    post = await getAdminNews(newsDeps, user, newsId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return <EmptyState title={tE("errors.NOT_FOUND")} />;
    }
    throw error;
  }
  const areas = (await listAreas(mongoContentStore, user)).map((a) => ({
    number: a.number,
    name: a.name,
  }));
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "";
  const publicUrl = post.slug ? `${getEnv().APP_URL}/novinky/${post.slug}` : null;
  const commsPackage = [
    post.title,
    "",
    ...post.sections
      .filter((s) => s.text.trim())
      .flatMap((s) => [
        post.kind === "academy" ? "" : tE(`sections.${s.key}`).toUpperCase(),
        s.text,
        "",
      ])
      .filter((line, i, all) => line !== "" || all[i - 1] !== ""),
    post.club ? tNews("byClub", { club: post.club.name }) : tNews("bySfz"),
    publicUrl ?? "",
  ].join("\n");
  const yesNo = (v: boolean) => (v ? t("yes") : t("no"));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/novinky?status=${post.status}`}
        className="subheadline flex items-center gap-1 self-start no-underline"
      >
        <Icon name="chevron-left" size={18} aria-hidden />
        {t("back")}
      </Link>
      <header className="flex flex-col gap-2">
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={NEWS_STATUS_TONE[post.status]} dot>
            {tStatus(post.status)}
          </Badge>
          <Badge tone={NEWS_KIND_TONE[post.kind]}>{tNews(`kind.${post.kind}`)}</Badge>
          {post.awaitsConfirmation && (
            <Badge tone="warning" dot>
              {t("awaits")}
            </Badge>
          )}
        </span>
        <h1 className="title-1 break-words">{post.title || tStatus("draft")}</h1>
        <p className="footnote text-(--ink-muted)">
          {[
            post.club ? `${t("club")}: ${post.club.name}` : tNews("sfz"),
            post.submittedAt ? t("submittedAt", { date: date(post.submittedAt) }) : null,
            post.publishedAt ? t("publishedAt", { date: date(post.publishedAt) }) : null,
            post.status === "published" ? t("views", { count: post.views }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {post.missing.length > 0 && (
          <p className="footnote text-(--warning-ink)">
            {t("missing", {
              parts: post.missing
                .map((m) => (m === "title" ? tE("title") : tE(`sections.${m}`)))
                .join(", "),
            })}
          </p>
        )}
        {post.status === "published" && post.slug && (
          <LinkButton href={`/novinky/${post.slug}`} variant="tertiary" size="sm">
            {t("openPublic")}
          </LinkButton>
        )}
      </header>

      {post.club && (
        <Card title={t("consents")}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt className="subheadline">{t("consentPublication")}</dt>
            <dd className="subheadline">{yesNo(post.consents.publication)}</dd>
            <dt className="subheadline">{t("consentExternal")}</dt>
            <dd className="subheadline">{yesNo(post.consents.external)}</dd>
          </dl>
        </Card>
      )}

      <NewsReview
        areas={areas}
        post={{
          id: post.id,
          kind: post.kind,
          status: post.status,
          club: post.club !== null,
          version: post.version,
          content: { title: post.title, areas: post.areas, sections: post.sections },
          pinned: post.pinned,
          externalUrl: post.externalUrl,
          consentExternal: post.consents.external,
          commsShared: post.commsSharedAt
            ? t("commsDone", { date: date(post.commsSharedAt) })
            : null,
          commsPackage,
        }}
      />
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <AdminNewsDetail {...props} />
    </Suspense>
  );
}
