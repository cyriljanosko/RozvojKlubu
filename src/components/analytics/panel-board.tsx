"use client";

import { useTranslations } from "next-intl";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { Button, Chip, IconButton } from "@/components/sfz";

export interface BoardPanel {
  id: string;
  title: string;
  note?: string;
  content: ReactNode;
}

export interface Layout {
  order: string[];
  hidden: string[];
}

/** Bump the suffix when panel ids change, so that old layouts are ignored. */
const STORAGE_KEY = "analytics.layout.v1";

const EMPTY: Layout = { order: [], hidden: [] };
const listeners = new Set<() => void>();
/** fallback when storage is blocked (private window) – remembered until the page reloads */
let memory: string | null = null;

function snapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeLayout(layout: Layout | null) {
  memory = layout ? JSON.stringify(layout) : null;
  try {
    if (memory) window.localStorage.setItem(STORAGE_KEY, memory);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked – the in-memory copy above is used
  }
  listeners.forEach((l) => l());
}

function parseLayout(raw: string | null): Layout {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Layout>) : null;
    return Array.isArray(parsed?.order) && Array.isArray(parsed?.hidden)
      ? { order: parsed.order, hidden: parsed.hidden }
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Analysis panels the viewer can reorder and hide; the layout lives in this browser (DA-c). */
export function PanelBoard({ panels }: { panels: BoardPanel[] }) {
  // the server render (null) uses the default order
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const layout = useMemo(() => parseLayout(raw), [raw]);
  return <BoardView panels={panels} layout={layout} onChange={writeLayout} />;
}

/**
 * Panels with arrows and "hide"; the caller keeps the layout (browser for the analysis, the account
 * for Moja Akadémia). `onChange(null)` = back to the default layout.
 */
export function BoardView({
  panels,
  layout,
  onChange,
  pending = false,
}: {
  panels: BoardPanel[];
  layout: Layout;
  onChange: (layout: Layout | null) => void;
  pending?: boolean;
}) {
  const t = useTranslations("board");
  const update = onChange;

  // panels missing from a stored order (e.g. the comparison) keep their default place
  const rank = (id: string) => {
    const i = layout.order.indexOf(id);
    return i === -1 ? layout.order.length + panels.findIndex((p) => p.id === id) : i;
  };
  const visible = panels
    .filter((p) => !layout.hidden.includes(p.id))
    .sort((a, b) => rank(a.id) - rank(b.id));
  const hidden = panels.filter((p) => layout.hidden.includes(p.id));

  const move = (index: number, by: -1 | 1) => {
    const ids = visible.map((p) => p.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    update({ ...layout, order: [...ids, ...layout.hidden] });
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 print:block" aria-busy={pending}>
        {visible.map((p, i) => (
          <section
            key={p.id}
            className="flex min-w-0 flex-col gap-3 rounded-(--radius-lg) bg-(--surface-raised) p-4 print:mb-4 print:break-inside-avoid"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="headline">{p.title}</h2>
                {p.note && <p className="footnote text-(--ink-muted)">{p.note}</p>}
              </div>
              <div className="-mt-2 -mr-2 flex shrink-0 print:hidden">
                <IconButton
                  icon="chevron-up"
                  variant="tertiary"
                  size="sm"
                  disabled={i === 0}
                  label={t("up", { title: p.title })}
                  onClick={() => move(i, -1)}
                />
                <IconButton
                  icon="chevron-down"
                  variant="tertiary"
                  size="sm"
                  disabled={i === visible.length - 1}
                  label={t("down", { title: p.title })}
                  onClick={() => move(i, 1)}
                />
                <IconButton
                  icon="x"
                  variant="tertiary"
                  size="sm"
                  label={t("hide", { title: p.title })}
                  onClick={() => update({ ...layout, hidden: [...layout.hidden, p.id] })}
                />
              </div>
            </div>
            {p.content}
          </section>
        ))}
      </div>
      {(hidden.length > 0 || layout.order.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {hidden.length > 0 && <span className="footnote text-(--ink-muted)">{t("hidden")}</span>}
          {hidden.map((p) => (
            <Chip
              key={p.id}
              icon="plus"
              aria-label={t("show", { title: p.title })}
              onClick={() =>
                update({ ...layout, hidden: layout.hidden.filter((id) => id !== p.id) })
              }
            >
              {p.title}
            </Chip>
          ))}
          <Button size="sm" variant="tertiary" onClick={() => update(null)}>
            {t("reset")}
          </Button>
        </div>
      )}
    </>
  );
}

/** Opens the browser's print dialog – "Save as PDF" gives the PDF export. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="sm" variant="secondary" icon="download" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
