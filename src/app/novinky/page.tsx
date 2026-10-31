import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AreaFilter } from "@/components/news/area-filter";
import { NewsCard, NewsList } from "@/components/news/news-items";
import { newsLabels } from "@/components/news/news-labels";
import { EmptyState, LinkButton, LinkChip } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { newsDeps } from "@/server/clubs/deps";
import { NEWS_KINDS, type NewsKind } from "@/server/db/types";
import { listPublishedNews } from "@/server/services/news.service";

export const metadata: Metadata = {
  title: defaultMessages.news.title,
  description: defaultMessages.news.lead,
};

type Props = PageProps<"/novinky">;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

/** Novinky (ADR 0023, design ZK approved 31. 10. 2026): public list with kind and area filters. */
async function NewsPage({ searchParams }: Props) {
  await connection();
  const q = await searchParams;
  const kind = NEWS_KINDS.includes(str(q.kind) as NewsKind) ? (str(q.kind) as NewsKind) : null;
  const areaNumber = Number(str(q.area));
  const area =
    Number.isInteger(areaNumber) && areaNumber >= 1 && areaNumber <= 11 ? areaNumber : null;
  const before = str(q.before);
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? before : undefined;

  const [t, labels, page] = await Promise.all([
    getTranslations("news"),
    newsLabels(),
    listPublishedNews(newsDeps, {
      kind: kind ?? undefined,
      area: area ?? undefined,
      before: beforeDate,
    }),
  ]);

  const href = (change: { kind?: string | null; area?: number | null; before?: string | null }) => {
    const next = new URLSearchParams();
    const merged = { kind, area, before: null, ...change };
    if (merged.kind) next.set("kind", merged.kind);
    if (merged.area) next.set("area", String(merged.area));
    if (merged.before) next.set("before", merged.before);
    const query = next.toString();
    return query ? `/novinky?${query}` : "/novinky";
  };
  const filtered = Boolean(kind || area);
  const nothing = !page.pinned && page.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="caption-2 text-(--brand-blue-ink) uppercase">{t("eyebrow")}</p>
        <h1 className="large-title">{t("title")}</h1>
        <p className="body text-(--ink-muted)">{t("lead")}</p>
      </header>

      <section className="flex flex-col gap-3">
        <nav
          aria-label={t("filterKind")}
          className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
        >
          <LinkChip href={href({ kind: null })} selected={!kind}>
            {t("kinds.all")}
          </LinkChip>
          {NEWS_KINDS.map((k) => (
            <LinkChip key={k} href={href({ kind: k })} selected={kind === k}>
              {t(`kinds.${k}`)}
            </LinkChip>
          ))}
        </nav>
        <AreaFilter
          label={t("area")}
          kind={kind}
          value={area ? String(area) : ""}
          options={[
            { value: "", label: t("allAreas") },
            ...Array.from({ length: 11 }, (_, i) => ({
              value: String(i + 1),
              label: t("areaOption", { number: i + 1, name: labels.areaName(i + 1) }),
            })),
          ]}
        />
      </section>

      {nothing ? (
        <EmptyState
          title={t("emptyTitle")}
          description={filtered || beforeDate ? t("emptyFiltered") : t("empty")}
          action={
            filtered || beforeDate ? (
              <LinkButton href="/novinky" variant="secondary">
                {t("showAll")}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {page.pinned && (
            <section aria-label={t("pinned")}>
              <NewsCard item={page.pinned} labels={labels} />
            </section>
          )}
          {page.items.length > 0 && <NewsList items={page.items} labels={labels} />}
        </>
      )}

      {(page.nextBefore || beforeDate) && (
        <nav className="flex flex-col gap-2">
          {page.nextBefore && (
            <LinkButton href={href({ before: page.nextBefore })} variant="secondary" block>
              {t("older")}
            </LinkButton>
          )}
          {beforeDate && (
            <Link href={href({ before: null })} className="subheadline self-center">
              {t("newest")}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <NewsPage {...props} />
      </Suspense>
    </main>
  );
}
