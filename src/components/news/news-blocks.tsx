import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge, LinkButton } from "@/components/sfz";
import { newsDeps } from "@/server/clubs/deps";
import { listClubNews, listPublishedNews, type NewsListItem } from "@/server/services/news.service";
import type { CurrentUser } from "@/server/services/users.service";

import { NEWS_STATUS_TONE, NewsCard, NewsList } from "./news-items";
import { newsLabels } from "./news-labels";

/** Academy home: the pinned or newest post as a card and two more; nothing while there are none. */
export async function HomeNews() {
  const page = await listPublishedNews(newsDeps, { limit: 3 });
  const items = [...(page.pinned ? [page.pinned] : []), ...page.items].slice(0, 3);
  if (items.length === 0) return null;
  const [t, labels] = await Promise.all([getTranslations("news"), newsLabels()]);
  const [first, ...rest] = items;
  return (
    <section aria-labelledby="home-news" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-news" className="title-2">
          {t("homeTitle")}
        </h2>
        <Link href="/novinky" className="subheadline no-underline">
          {t("all")}
        </Link>
      </div>
      <NewsCard item={first} labels={labels} />
      {rest.length > 0 && <NewsList items={rest} labels={labels} />}
    </section>
  );
}

/** Area detail: "Novinky k oblasti" – the newest academy news, club stories and tips of the area. */
export async function AreaNews({ area, areaName }: { area: number; areaName: string }) {
  const page = await listPublishedNews(newsDeps, { area, limit: 3 });
  const items = [...(page.pinned ? [page.pinned] : []), ...page.items].slice(0, 3);
  if (items.length === 0) return null;
  const [t, labels] = await Promise.all([getTranslations("news"), newsLabels()]);
  return (
    <section aria-labelledby="area-news" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="area-news" className="title-3">
          {t("areaTitle")}
        </h2>
        <p className="subheadline text-(--ink-muted)">{t("areaLead", { name: areaName })}</p>
      </div>
      <NewsList items={items} labels={labels} />
      <LinkButton href={`/novinky?area=${area}`} variant="tertiary" block>
        {t("areaAll", { number: area })}
      </LinkButton>
    </section>
  );
}

/**
 * Moja Akadémia tile: posts for the club's weakest Kompas areas and the areas of its plan goals,
 * then the newest ones (ADR 0023, point 9).
 */
export async function NewsTile({
  weakAreas,
  planAreas,
  proposals,
}: {
  weakAreas: readonly number[];
  planAreas: readonly number[];
  /** club management sees the state of the club's latest unpublished proposal */
  proposals?: { user: CurrentUser; clubId: string } | null;
}) {
  const [t, tStatus, labels] = await Promise.all([
    getTranslations("news"),
    getTranslations("clubNews.status"),
    newsLabels(),
  ]);
  const proposal = proposals
    ? ((await listClubNews(newsDeps, proposals.user, proposals.clubId)).items.find((p) =>
        ["draft", "submitted", "returned"].includes(p.status),
      ) ?? null)
    : null;
  const picked: { item: NewsListItem; reason: string }[] = [];
  const seen = new Set<string>();
  const add = (items: readonly NewsListItem[], reason: string, max: number) => {
    for (const item of items) {
      if (picked.length >= max) return;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      picked.push({ item, reason });
    }
  };
  for (const area of weakAreas.slice(0, 2)) {
    add((await listPublishedNews(newsDeps, { area, limit: 2 })).items, t("tileWeak"), 2);
  }
  for (const area of planAreas.slice(0, 3)) {
    add((await listPublishedNews(newsDeps, { area, limit: 2 })).items, t("tilePlan"), 3);
  }
  add((await listPublishedNews(newsDeps, { limit: 3 })).items, t("tileLatest"), 3);

  const proposalRow = proposal && proposals && (
    <Link
      href={`/klub/${encodeURIComponent(proposals.clubId)}/novinky/${proposal.id}`}
      className="flex items-center gap-3 rounded-(--radius-md) bg-(--brand-blue-tint) p-3 text-(--ink) no-underline"
    >
      <span className="headline min-w-0 flex-1 break-words">
        {t("tileProposal", { title: proposal.title || "…" })}
      </span>
      <Badge tone={NEWS_STATUS_TONE[proposal.status]} dot className="shrink-0">
        {tStatus(proposal.status)}
      </Badge>
    </Link>
  );
  if (picked.length === 0) {
    return (
      <>
        <p className="subheadline text-(--ink-muted)">{t("tileNone")}</p>
        {proposalRow}
      </>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {picked.map(({ item, reason }) => (
          <li key={item.id} className="flex flex-col gap-0.5">
            <Link href={`/novinky/${item.slug}`} className="headline break-words no-underline">
              {item.title}
            </Link>
            <span className="footnote text-(--ink-muted)">
              {[reason, ...item.areas.slice(0, 1).map(labels.area)].join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      {proposalRow}
      <Link href="/novinky" className="subheadline self-start">
        {t("tileAll")}
      </Link>
    </>
  );
}
