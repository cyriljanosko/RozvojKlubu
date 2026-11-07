"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { IconButton } from "./ds";
import { useSheetFocus } from "./sheet";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  id?: string;
  children: ReactNode;
}

/** Drag distance in px after which letting go closes the sheet. */
const CLOSE_DRAG = 80;

/**
 * Bottom sheet above the TabBar on phones (ADR 0035; the design system has none yet – proposed for it).
 * The TabBar stays visible; the scrim covers the page between the header and the sheet. Closed by ×,
 * the scrim, Esc, dragging the grip down, or by the caller (a pick, a page change).
 */
export function BottomSheet({ open, onClose, title, closeLabel, id, children }: BottomSheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  useSheetFocus(open, panel, onClose, "button");

  if (!open) return null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // the close button keeps its click; capturing the pointer would swallow it
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    const moved = drag.current?.dy ?? 0;
    drag.current = null;
    if (panel.current) panel.current.style.transform = "";
    if (moved > CLOSE_DRAG) onClose();
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-x-0 top-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-(--z-drawer) bg-(--overlay) md:hidden print:hidden"
      />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-(--z-drawer) flex max-h-[78dvh] flex-col rounded-t-(--radius-lg) bg-(--surface) text-(--ink) shadow-(--shadow-modal) transition-transform duration-(--duration-fast) md:hidden print:hidden"
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col px-4 pt-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span
            aria-hidden
            className="mx-auto h-1.5 w-9 rounded-(--radius-pill) bg-(--border-strong) opacity-50"
          />
          <div className="flex items-center justify-between gap-2">
            <h2 className="headline">{title}</h2>
            <IconButton icon="x" label={closeLabel} onClick={onClose} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </div>
    </>
  );
}
