"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared behaviour of the sheets that the design system does not have yet (ADR 0035): Esc closes,
 * focus moves into the sheet on open and back to where it came from on close.
 */
export function useSheetFocus(
  open: boolean,
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus = "a[href], button, input",
) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const from = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>(initialFocus)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // only give focus back when it was inside the sheet – someone who clicked elsewhere keeps it there
      const now = document.activeElement;
      if (!now || now === document.body || node?.contains(now)) from?.focus?.();
    };
  }, [open, panel, initialFocus]);
}
