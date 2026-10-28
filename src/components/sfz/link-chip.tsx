import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A filter or choice that navigates (role on the Hub, club picker), styled as the design system's Chip.
 * The design system's Chip is a <button>; links use its classes and mark the choice with aria-current.
 */
export function LinkChip({
  href,
  selected,
  children,
}: {
  href: string;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={selected ? "sfz-chip is-selected no-underline" : "sfz-chip no-underline"}
    >
      <span>{children}</span>
    </Link>
  );
}
