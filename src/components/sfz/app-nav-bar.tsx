import Link from "next/link";
import type { ReactNode } from "react";

interface AppNavBarProps {
  /** Logo (next/image) shown after `start`; links to `brandHref`. */
  brand: ReactNode;
  brandHref?: string;
  brandLabel: string;
  /** Before the logo: the menu sheet button (ADR 0035). */
  start?: ReactNode;
  /** Middle of the bar: the search field. */
  center?: ReactNode;
  /** Right side: account, sign-in. */
  actions?: ReactNode;
}

/**
 * The design system's NavBar markup (ADR 0018) in the layout of ADR 0035: menu button · logo ·
 * search in the middle · account. The row of links is gone – the menu sheet carries all of them.
 */
export function AppNavBar({
  brand,
  brandHref = "/",
  brandLabel,
  start,
  center,
  actions,
}: AppNavBarProps) {
  return (
    <header className="sfz-navbar sfz-navbar--light print:hidden">
      <div className="sfz-navbar__inner gap-2 md:gap-3">
        {start}
        <Link className="sfz-navbar__brand" href={brandHref} aria-label={brandLabel}>
          {brand}
        </Link>
        <span aria-hidden className="flex-1" />
        {center}
        <span aria-hidden className="hidden flex-1 md:block" />
        {actions && <div className="flex items-center gap-1 md:gap-2">{actions}</div>}
      </div>
    </header>
  );
}
