import Link from "next/link";

import { Badge, Icon } from "@/components/sfz";
import type { NewsKind } from "@/server/db/types";
import type { NewsListItem } from "@/server/services/news.service";

/** Badge tone per kind (design ZK – Novinky, approved 31. 10. 2026). */
export const NEWS_KIND_TONE: Record<NewsKind, "brand" | "success" | "info"> = {
  story: "brand",
  tip: "success",
  academy: "info",
};

export interface NewsLabels {
  kind: Record<NewsKind, string>;
  sfz: string;
  /** area number → "3 · Tréneri" */
  area: (n: number) => string;
  date: (iso: string) => string;
}

const meta = (item: NewsListItem, l: NewsLabels) =>
  [item.club?.name ?? l.sfz, ...item.areas.slice(0, 1).map(l.area), l.date(item.publishedAt)].join(
    " · ",
  );

/** The large card: pinned post on Novinky, the newest one on the Academy home. */
export function NewsCard({ item, labels }: { item: NewsListItem; labels: NewsLabels }) {
  return (
    <Link
      href={`/novinky/${item.slug}`}
      className="flex flex-col gap-2 rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink) no-underline"
    >
      <span className="flex flex-wrap gap-1.5">
        <Badge tone={NEWS_KIND_TONE[item.kind]}>{labels.kind[item.kind]}</Badge>
        {item.areas.map((n) => (
          <Badge key={n} tone="neutral">
            {labels.area(n)}
          </Badge>
        ))}
      </span>
      <span className="title-3 break-words">{item.title}</span>
      {item.excerpt && <span className="subheadline text-(--ink-muted)">{item.excerpt}</span>}
      <span className="footnote text-(--ink-muted)">
        {[item.club?.name ?? labels.sfz, labels.date(item.publishedAt)].join(" · ")}
      </span>
    </Link>
  );
}

/** A list of posts as rows (Novinky, related posts, area detail, home). */
export function NewsList({
  items,
  labels,
  showKind = true,
}: {
  items: readonly NewsListItem[];
  labels: NewsLabels;
  showKind?: boolean;
}) {
  return (
    <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
      {items.map((item) => (
        <li key={item.id} className="border-b border-(--hairline) last:border-b-0">
          <Link
            href={`/novinky/${item.slug}`}
            className="flex min-h-14 items-center gap-3 px-4 py-3 text-(--ink) no-underline"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              {showKind && (
                <span className="flex">
                  <Badge tone={NEWS_KIND_TONE[item.kind]}>{labels.kind[item.kind]}</Badge>
                </span>
              )}
              <span className="headline break-words">{item.title}</span>
              <span className="footnote text-(--ink-muted)">{meta(item, labels)}</span>
            </span>
            <Icon name="chevron-right" size={18} aria-hidden className="shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
