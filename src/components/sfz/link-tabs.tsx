"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeLinkId, type NavLink } from "./nav-active";

interface LinkTabsProps {
  items: readonly NavLink[];
  navLabel: string;
  variant?: "underline" | "segmented";
}

/**
 * Sub-menu (club, mentor) as page links styled like the design system's Tabs (ADR 0018).
 * These are navigation, not a tablist, so they render as <nav> with aria-current.
 */
export function LinkTabs({ items, navLabel, variant = "underline" }: LinkTabsProps) {
  const pathname = usePathname();
  const active = activeLinkId(pathname, items);
  return (
    <nav aria-label={navLabel}>
      <div className={`sfz-tabs sfz-tabs--${variant}`}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={
              item.id === active ? "sfz-tab is-active no-underline" : "sfz-tab no-underline"
            }
            aria-current={item.id === active ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
