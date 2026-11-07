"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "./ds";
import { activeLinkId, type NavLink } from "./nav-active";
import { useSheetFocus } from "./sheet";

/** A titled column of the menu sheet. Plain data, safe to pass from server components. */
export interface MenuSheetSection {
  id: string;
  title: string;
  items: readonly NavLink[];
}

export interface MenuSheetLabels {
  /** Name of the whole menu ("Celé menu"): button label, dialog title. */
  title: string;
  close: string;
  /** Hint next to the Esc key ("zavrie"). */
  escCloses: string;
}

const noop = () => () => {};
/** False during server rendering and hydration, true afterwards: the no-JS link becomes a button. */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/** The columns of the menu (ADR 0035), shared by the header sheet and the bottom sheet on phones. */
export function MenuPanel({
  sections,
  onPick,
  columns = "auto",
}: {
  sections: readonly MenuSheetSection[];
  onPick?: () => void;
  /** "auto": as many columns as fit (desktop); "two": two columns (phone). */
  columns?: "auto" | "two";
}) {
  const pathname = usePathname();
  const active = activeLinkId(
    pathname,
    sections.flatMap((section) => section.items),
  );
  return (
    <div
      className={
        columns === "two"
          ? "grid grid-cols-2 gap-x-3 gap-y-4"
          : "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4"
      }
    >
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`menu-${section.id}`} className="min-w-0">
          <h3
            id={`menu-${section.id}`}
            className="label mb-1 truncate px-2.5 text-(--ink-muted) uppercase"
          >
            {section.title}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const on = item.id === active;
              return (
                <li key={`${section.id}-${item.id}`}>
                  <Link
                    href={item.href}
                    onClick={onPick}
                    aria-current={on ? "page" : undefined}
                    className={`subheadline flex min-h-(--touch-target) items-center gap-2.5 rounded-(--radius-sm) px-2.5 no-underline ${
                      on
                        ? "bg-(--brand-blue-tint) font-semibold text-(--brand-blue-ink)"
                        : "text-(--ink) hover:bg-(--surface-raised)"
                    }`}
                  >
                    {item.icon && <Icon name={item.icon} size={18} />}
                    <span className="min-w-0 break-words">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Menu button in the header and the sheet it opens under the header (ADR 0035, after Contineo's
 * "SectionsSheet"). Without JavaScript the button is a link to `fallbackHref` (/viac) with the same items.
 * Esc, the scrim, a pick and a page change close it; focus goes in and back.
 */
export function MenuSheetButton({
  sections,
  labels,
  fallbackHref,
  className,
}: {
  sections: readonly MenuSheetSection[];
  labels: MenuSheetLabels;
  fallbackHref: string;
  className?: string;
}) {
  const pathname = usePathname();
  const ready = useHydrated();
  const panel = useRef<HTMLDivElement>(null);
  // open for the page it was opened on – a page change closes it without an effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  useSheetFocus(open, panel, close, "a[href]");

  return (
    <>
      <a
        href={fallbackHref}
        role={ready ? "button" : undefined}
        aria-expanded={ready ? open : undefined}
        aria-controls={ready ? "menu-sheet" : undefined}
        aria-label={labels.title}
        title={labels.title}
        onClick={(event) => {
          event.preventDefault();
          setOpenOn(open ? null : pathname);
        }}
        className={`sfz-btn sfz-btn--icon sfz-btn--tertiary sfz-btn--md ${
          open ? "bg-(--brand-blue-tint) text-(--brand-blue-ink)" : ""
        } ${className ?? ""}`}
      >
        <Icon name="menu" size={20} />
      </a>
      {open && (
        <>
          <div
            aria-hidden
            onClick={close}
            className="fixed inset-x-0 top-[calc(var(--navbar-height)+env(safe-area-inset-top))] bottom-0 z-(--z-drawer) bg-(--overlay) print:hidden"
          />
          <div
            ref={panel}
            id="menu-sheet"
            role="dialog"
            aria-label={labels.title}
            className="fixed top-[calc(var(--navbar-height)+env(safe-area-inset-top)+8px)] left-[max(12px,env(safe-area-inset-left))] z-(--z-drawer) flex max-h-[calc(100dvh-var(--navbar-height)-24px)] w-[min(880px,calc(100vw-24px))] flex-col gap-3 overflow-y-auto rounded-(--radius-md) bg-(--surface) p-4 text-(--ink) shadow-(--shadow-modal) print:hidden"
          >
            <MenuPanel sections={sections} onPick={close} />
            <p className="footnote flex items-center gap-1.5 border-t border-(--hairline) pt-3 text-(--ink-muted)">
              <kbd className="rounded-(--radius-xs) border border-(--border) px-1.5 font-mono text-xs">
                Esc
              </kbd>
              {labels.escCloses}
            </p>
          </div>
        </>
      )}
    </>
  );
}
