import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { NEWS_KIND_TONE, NewsList } from "@/components/news/news-items";
import { newsLabels } from "@/components/news/news-labels";
import { splitLinks } from "@/components/news/news-text";
import { ShareButton } from "@/components/news/share-button";
import { Badge, Card, Icon } from "@/components/sfz";
import { ApiError } from "@/server/api/errors";
import { newsDeps } from "@/server/clubs/deps";
import { getEnv } from "@/server/env";
import { getPublishedNews, type NewsDetail } from "@/server/services/news.service";

type Props = PageProps<"/novinky/[slug]">;

async function load(slug: string, countView = false): Promise<NewsDetail | null> {
  try {
    return await getPublishedNews(newsDeps, slug, { countView });
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

/** Title and first sentence for search engines and link previews (ADR 0023, point 8). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const post = await load(decodeURIComponent(slug));
  if (!post) return {};
  const url = `${getEnv().APP_URL}/novinky/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url,
      publishedTime: post.publishedAt,
    },
  };
}

/** A line with its links: [label](https://…) or a bare address, opened in a new tab. */
function Line({ text }: { text: string }) {
  return splitLinks(text).map((part, i) =>
    "href" in part ? (
      <a
        key={i}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium break-words text-(--brand-blue-ink) underline underline-offset-4"
      >
        {part.text}
        {/* links out of the Academy are marked, as in the Metodika */}
        <span aria-hidden> ↗</span>
      </a>
    ) : (
      part.text
    ),
  );
}

/** Text in paragraphs (empty line) with simple "- " lists and links. */
function Paragraphs({ text }: { text: string }) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const lines = block.split("\n").map((l) => l.trim());
      if (lines.every((l) => l.startsWith("- "))) {
        return (
          <ul key={i} className="body flex list-disc flex-col gap-1 pl-5">
            {lines.map((l, j) => (
              <li key={j}>
                <Line text={l.slice(2)} />
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={i} className="body whitespace-pre-line">
          <Line text={block} />
        </p>
      );
    });
}

/** A published post (ADR 0023, design ZK approved 31. 10. 2026). Photos arrive with the storage. */
async function NewsDetailPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const post = await load(decodeURIComponent(slug), true);
  if (!post) notFound();
  const [t, labels] = await Promise.all([getTranslations("news"), newsLabels()]);
  const url = `${getEnv().APP_URL}/novinky/${post.slug}`;
  const sections = post.sections.filter((s) => s.text.trim());
  const advice = post.kind === "academy" ? null : sections.find((s) => s.key === "advice");

  return (
    <article className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/novinky" className="subheadline flex items-center gap-1 no-underline">
          <Icon name="chevron-left" size={18} aria-hidden />
          {t("back")}
        </Link>
        <ShareButton
          url={url}
          title={post.title}
          labels={{
            share: t("share"),
            title: t("shareTitle"),
            copy: t("copyLink"),
            copied: t("copied"),
            facebook: t("facebook"),
            whatsapp: t("whatsapp"),
            email: t("email"),
            note: t("shareNote"),
            close: t("close"),
          }}
        />
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={NEWS_KIND_TONE[post.kind]}>{labels.kind[post.kind]}</Badge>
          {post.areas.map((n) => (
            <Badge key={n} tone="neutral">
              {labels.area(n)}
            </Badge>
          ))}
        </div>
        <h1 className="title-1 break-words">{post.title}</h1>
        <p className="footnote text-(--ink-muted)">
          {post.club ? (
            <Link href={`/vizitka/${encodeURIComponent(post.club.clubId)}`}>{post.club.name}</Link>
          ) : (
            labels.sfz
          )}
          {" · "}
          {labels.date(post.publishedAt)}
        </p>
      </header>

      {post.kind === "academy" ? (
        sections.map((s) => (
          <div key={s.key} className="flex flex-col gap-3">
            <Paragraphs text={s.text} />
          </div>
        ))
      ) : (
        <>
          {sections
            .filter((s) => s.key !== "advice")
            .map((s) => (
              <section key={s.key} className="flex flex-col gap-2">
                <h2 className="title-3">{t(`sections.${s.key as "start" | "done" | "result"}`)}</h2>
                <Paragraphs text={s.text} />
              </section>
            ))}
          {advice && (
            <Card variant="highlight" title={t("sections.advice")}>
              <div className="flex flex-col gap-3">
                <Paragraphs text={advice.text} />
              </div>
            </Card>
          )}
        </>
      )}

      {post.areas.length > 0 && (
        <nav className="flex flex-col gap-1">
          {post.areas.map((n) => (
            <Link key={n} href={`/oblasti/${n}`} className="subheadline self-start">
              {t("moreInArea", { number: n, name: labels.areaName(n) })}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-1 border-t border-(--hairline) pt-4">
        <p className="footnote text-(--ink-muted)">
          {post.club
            ? t(post.editedBySfz ? "byClubEdited" : "byClub", { club: post.club.name })
            : t("bySfz")}
        </p>
        {post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="footnote self-start"
          >
            {t("onSfzWeb")}
          </a>
        )}
      </div>

      {post.related.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="title-3">{t("related")}</h2>
          <NewsList items={post.related} labels={labels} />
        </section>
      )}
    </article>
  );
}

export default function Page(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <NewsDetailPage {...props} />
      </Suspense>
    </main>
  );
}
