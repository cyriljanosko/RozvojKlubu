import type { ReactNode } from "react";

import { Icon } from "./ds";

interface AccordionItemProps {
  title: ReactNode;
  /** Secondary line under the title (e.g. role marks of a Metodika section). */
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  children: ReactNode;
}

/**
 * Collapsible section – the design system has no accordion yet (ADR 0018, gap to propose upstream).
 * Native <details>, so it works without JavaScript; rows follow the grouped-list look of the design system.
 */
export function AccordionItem({ title, subtitle, defaultOpen, id, children }: AccordionItemProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group border-b border-(--hairline) last:border-b-0"
    >
      <summary className="flex min-h-(--touch-target) cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="headline">{title}</span>
          {subtitle && <span className="footnote text-(--ink-muted)">{subtitle}</span>}
        </span>
        <span className="text-(--ink-muted) transition-transform group-open:rotate-180" aria-hidden>
          <Icon name="chevron-down" size={18} />
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/** Groups AccordionItems on a raised surface, like iOS grouped lists. */
export function Accordion({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">{children}</div>
  );
}
