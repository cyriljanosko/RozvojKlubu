"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "./ds";
import { activeLinkId, type NavLink } from "./nav-active";

interface AppTabBarProps {
  /** At most five items, each with an icon (design system TabBar rule). */
  items: readonly (NavLink & { icon: string; badge?: number })[];
  navLabel: string;
}

/**
 * The design system's TabBar markup with next/link (ADR 0018). Visible below 768 px only;
 * the page needs bottom padding of `--tabbar-height` + safe area, which the app frame adds.
 */
export function AppTabBar({ items, navLabel }: AppTabBarProps) {
  const pathname = usePathname();
  const shown = items.slice(0, 5);
  const active = activeLinkId(pathname, shown);
  return (
    <nav className="sfz-tabbar print:hidden" aria-label={navLabel}>
      {shown.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={item.id === active ? "sfz-tabbar__item is-active" : "sfz-tabbar__item"}
          aria-current={item.id === active ? "page" : undefined}
        >
          <span className="sfz-tabbar__icon">
            <Icon name={item.icon} size={24} />
            {item.badge ? (
              <span className="sfz-tabbar__badge">{item.badge > 99 ? "99+" : item.badge}</span>
            ) : null}
          </span>
          <span className="sfz-tabbar__label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
