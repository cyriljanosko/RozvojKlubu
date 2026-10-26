import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "./ds";

type Variant = "primary" | "secondary" | "tertiary" | "danger";
type Size = "sm" | "md" | "lg";

interface LinkButtonProps {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: string;
  block?: boolean;
  children: ReactNode;
}

/**
 * A link that looks like the design system's Button (ADR 0018). The design system's Button
 * renders <button>, which must not be nested in <a>, so navigation uses its classes on next/link.
 */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  block,
  children,
}: LinkButtonProps) {
  const classes = ["sfz-btn", `sfz-btn--${variant}`, `sfz-btn--${size}`, block && "sfz-btn--block"]
    .filter(Boolean)
    .join(" ");
  return (
    <Link href={href} className={classes}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
      <span className="sfz-btn__label">{children}</span>
    </Link>
  );
}

/** Icon-only link styled as the design system's IconButton; `label` is required for screen readers. */
export function LinkIconButton({
  href,
  icon,
  label,
  variant = "tertiary",
  size = "md",
}: {
  href: string;
  icon: string;
  label: string;
  variant?: Variant;
  size?: Size;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={["sfz-btn", "sfz-btn--icon", `sfz-btn--${variant}`, `sfz-btn--${size}`].join(" ")}
    >
      <Icon name={icon} size={size === "sm" ? 18 : 22} />
    </Link>
  );
}
