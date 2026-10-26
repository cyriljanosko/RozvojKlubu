"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "./ds";
import { activeLinkId, type NavLink } from "./nav-active";

interface AppNavBarProps {
  /** Logo (next/image) shown on the left; links to `brandHref`. */
  brand: ReactNode;
  brandHref?: string;
  brandLabel: string;
  /** Main menu; the design system hides it below 768 px, where AppTabBar takes over. */
  items: readonly NavLink[];
  /** Right side: search, account, sign-in. */
  actions?: ReactNode;
  navLabel: string;
}

/**
 * The design system's NavBar markup with next/link instead of <a href> (ADR 0018),
 * so moving between pages stays a client-side navigation.
 */
export function AppNavBar({
  brand,
  brandHref = "/",
  brandLabel,
  items,
  actions,
  navLabel,
}: AppNavBarProps) {
  const pathname = usePathname();
  const active = activeLinkId(pathname, items);
  return (
    <header className="sfz-navbar sfz-navbar--light print:hidden">
      <div className="sfz-navbar__inner">
        <Link className="sfz-navbar__brand" href={brandHref} aria-label={brandLabel}>
          {brand}
        </Link>
        <nav className="sfz-navbar__nav" aria-label={navLabel}>
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={item.id === active ? "sfz-navbar__link is-active" : "sfz-navbar__link"}
              aria-current={item.id === active ? "page" : undefined}
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              {item.label}
            </Link>
          ))}
        </nav>
        {actions && <div className="sfz-navbar__actions">{actions}</div>}
      </div>
    </header>
  );
}
