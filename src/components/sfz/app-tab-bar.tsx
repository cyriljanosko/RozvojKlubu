"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./ds";
import { MenuPanel, useHydrated, type MenuSheetLabels, type MenuSheetSection } from "./menu-sheet";
import { activeTabId, type NavLink } from "./nav-active";

interface AppTabBarProps {
  /** At most five items, each with an icon (design system TabBar rule). */
  items: readonly (NavLink & { icon: string; badge?: number })[];
  navLabel: string;
  /** Items of the "Menu" sheet: their sections keep the "more" tab active. */
  more?: readonly NavLink[];
  /**
   * The menu sheet behind the "more" tab (ADR 0035). With it, the tab opens a bottom sheet;
   * without JavaScript it stays a link to its page (/viac).
   */
  menu?: { sections: readonly MenuSheetSection[]; labels: MenuSheetLabels };
}

/**
 * The design system's TabBar markup with next/link (ADR 0018). Visible below 768 px only;
 * the page needs bottom padding of `--tabbar-height` + safe area, which the app frame adds.
 */
export function AppTabBar({ items, navLabel, more = [], menu }: AppTabBarProps) {
  const pathname = usePathname();
  const ready = useHydrated();
  // open for the page it was opened on – a page change closes it without an effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const shown = items.slice(0, 5);
  const routeActive = activeTabId(pathname, shown, more);

  const body = (item: AppTabBarProps["items"][number]): ReactNode => (
    <>
      <span className="sfz-tabbar__icon">
        <Icon name={item.icon} size={24} />
        {item.badge ? (
          <span className="sfz-tabbar__badge">{item.badge > 99 ? "99+" : item.badge}</span>
        ) : null}
      </span>
      <span className="sfz-tabbar__label">{item.label}</span>
    </>
  );

  return (
    <>
      <nav className="sfz-tabbar print:hidden" aria-label={navLabel}>
        {shown.map((item) => {
          const isMenu = Boolean(menu) && item.id === "more";
          // while the sheet is open, the Menu tab is the active one
          const active = open ? isMenu : item.id === routeActive;
          const className = active ? "sfz-tabbar__item is-active" : "sfz-tabbar__item";
          if (isMenu) {
            return (
              <a
                key={item.id}
                href={item.href}
                className={className}
                role={ready ? "button" : undefined}
                aria-expanded={ready ? open : undefined}
                aria-controls={ready ? "menu-bottom-sheet" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setOpenOn(open ? null : pathname);
                }}
              >
                {body(item)}
              </a>
            );
          }
          return (
            <Link
              key={item.id}
              href={item.href}
              className={className}
              aria-current={active ? "page" : undefined}
            >
              {body(item)}
            </Link>
          );
        })}
      </nav>
      {menu && (
        <BottomSheet
          id="menu-bottom-sheet"
          open={open}
          onClose={() => setOpenOn(null)}
          title={menu.labels.title}
          closeLabel={menu.labels.close}
        >
          <MenuPanel sections={menu.sections} onPick={() => setOpenOn(null)} columns="two" />
        </BottomSheet>
      )}
    </>
  );
}
