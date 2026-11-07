import Link from "next/link";

import { Icon } from "./ds";

export interface BreadcrumbItem {
  label: string;
  /** null: plain text – the current page (last item) or a section without its own page. */
  href: string | null;
}

/**
 * Breadcrumb band under the header (ADR 0035; the design system has none yet – proposed for it).
 * From 768 px the whole path; on phones only the parent (with a back chevron) and the current page.
 * Plain links: works without JavaScript.
 */
export function Breadcrumbs({ items, label }: { items: readonly BreadcrumbItem[]; label: string }) {
  if (items.length < 2) return null;
  const parent = items.length - 2;
  return (
    <nav aria-label={label} className="border-b border-(--hairline) bg-(--surface) print:hidden">
      <ol className="footnote mx-auto flex w-full max-w-[1200px] items-center gap-1.5 overflow-hidden px-4 py-2 whitespace-nowrap text-(--ink-muted) md:px-6">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          // phones: only the parent and the current page
          const phone = index >= parent ? "flex" : "hidden md:flex";
          return (
            <li key={`${index}-${item.label}`} className={`${phone} min-w-0 items-center gap-1.5`}>
              {index > 0 && (
                <span aria-hidden className={index === parent + 1 ? "" : "hidden md:inline"}>
                  <Icon name="chevron-right" size={14} />
                </span>
              )}
              {index === parent && (
                <span aria-hidden className="md:hidden">
                  <Icon name="chevron-left" size={14} />
                </span>
              )}
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-(--ink)">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="truncate text-(--brand-blue-ink) no-underline hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
