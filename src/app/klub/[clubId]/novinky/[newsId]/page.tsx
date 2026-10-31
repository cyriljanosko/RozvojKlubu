import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NEWS_KIND_TONE, NEWS_STATUS_TONE } from "@/components/news/news-items";
import { Alert, Badge, EmptyState, Icon, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import { listAreas } from "@/server/services/content.service";
import { getClubNews, listClubNews } from "@/server/services/news.service";

import { ClubNewsForm } from "./club-news-form";

export const metadata: Metadata = { title: defaultMessages.clubNews.editTitle };

type Props = PageProps<"/klub/[clubId]/novinky/[newsId]">;

/** One proposal: the form while it is the club's (draft, returned), read-only otherwise. */
async function ClubNewsDetail({ params }: Props) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const { clubId: rawClubId, newsId } = await params;
  const clubId = decodeURIComponent(rawClubId);
  const [t, tNews, tE] = await Promise.all([
    getTranslations("clubNews"),
    getTranslations("news"),
    getTranslations("newsEditor"),
  ]);
  let post;
  let canEdit = false;
  try {
    [post, { canEdit }] = await Promise.all([
      getClubNews(newsDeps, user, clubId, newsId),
      listClubNews(newsDeps, user, clubId),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
      return (
        <EmptyState title={error.code === "FORBIDDEN" ? t("forbidden") : tE("errors.NOT_FOUND")} />
      );
    }
    throw error;
  }
  const areas = (await listAreas(mongoContentStore, user)).map((a) => ({
    number: a.number,
    name: a.name,
  }));
  const editable = canEdit && (post.status === "draft" || post.status === "returned");
  const back = `/klub/${encodeURIComponent(clubId)}/novinky`;

  return (
    <div className="flex flex-col gap-6">
      <Link href={back} className="subheadline flex items-center gap-1 self-start no-underline">
        <Icon name="chevron-left" size={18} aria-hidden />
        {t("back")}
      </Link>
      <header className="flex flex-col gap-2">
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={NEWS_STATUS_TONE[post.status]} dot>
            {t(`status.${post.status}`)}
          </Badge>
          <Badge tone={NEWS_KIND_TONE[post.kind]}>{tNews(`kind.${post.kind}`)}</Badge>
        </span>
        <h1 className="title-1 break-words">{post.title || t("untitled")}</h1>
      </header>

      {post.status === "returned" && post.reviewNote && (
        <Alert
          tone={post.awaitsConfirmation ? "warning" : "danger"}
          title={post.awaitsConfirmation ? t("confirmTitle") : t("returnedTitle")}
        >
          <p className="whitespace-pre-line">{post.reviewNote}</p>
          {post.awaitsConfirmation && <p className="mt-2">{t("confirmText")}</p>}
        </Alert>
      )}
      {post.status === "submitted" && <Alert tone="info">{t("submittedText")}</Alert>}
      {post.status === "published" && post.slug && (
        <Alert
          tone="success"
          action={
            <LinkButton href={`/novinky/${post.slug}`} size="sm" variant="secondary">
              {t("open")}
            </LinkButton>
          }
        >
          {t("publishedText")}
        </Alert>
      )}

      {editable ? (
        <ClubNewsForm
          clubId={clubId}
          newsId={post.id}
          kind={post.kind}
          initial={{ title: post.title, areas: post.areas, sections: post.sections }}
          version={post.version}
          consents={{ photoPeople: post.consents.photoPeople, external: post.consents.external }}
          areas={areas}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {post.sections
            .filter((s) => s.text.trim())
            .map((s) => (
              <section key={s.key} className="flex flex-col gap-1">
                <h2 className="headline">{tE(`sections.${s.key}`)}</h2>
                <p className="body whitespace-pre-line">{s.text}</p>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden />}>
      <ClubNewsDetail {...props} />
    </Suspense>
  );
}
