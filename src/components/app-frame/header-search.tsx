"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Icon, IconButton } from "@/components/sfz";

/** One hit of GET /api/v1/search (search.service SearchHit, without the score). */
interface Hit {
  kind: "area" | "section" | "practice" | "template" | "club";
  title: string;
  area: { number: number; name: string } | null;
  snippet: string;
  href: string;
}

const SEARCH_PATH = "/hladat";
const MAX_HITS = 6;
const DEBOUNCE_MS = 200;
/** search.service needs a term of at least two letters */
const MIN_LENGTH = 2;

type Status = "idle" | "loading" | "done" | "error";

/**
 * Live results while typing (ADR 0035, phase 1 without AI): the same search as /hladat, through
 * GET /api/v1/search. The request starts on typing, so it is an event, not data loading for the page.
 */
function useLiveSearch(query: string) {
  const [state, setState] = useState<{ for: string; hits: Hit[]; status: Status }>({
    for: "",
    hits: [],
    status: "idle",
  });
  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((prev) => ({ ...prev, for: q, status: "loading" }));
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`search ${response.status}`);
        const body = (await response.json()) as { data: { hits: Hit[] } };
        setState({ for: q, hits: body.data.hits.slice(0, MAX_HITS), status: "done" });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(`[header-search] ${(error as Error).message}`);
          setState({ for: q, hits: [], status: "error" });
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  if (q.length < MIN_LENGTH) return { hits: [], status: "idle" as Status };
  // results of an older query are kept while the new one loads, so the list does not blink
  return { hits: state.hits, status: state.for === q ? state.status : ("loading" as Status) };
}

const allHref = (q: string) => `${SEARCH_PATH}?q=${encodeURIComponent(q.trim())}`;

/** The list under the field: hits, then "all results". Shared by the desktop panel and the phone sheet. */
function Results({
  query,
  hits,
  status,
  activeIndex,
  listId,
  onPick,
}: {
  query: string;
  hits: Hit[];
  status: Status;
  activeIndex: number;
  listId: string;
  onPick: () => void;
}) {
  const t = useTranslations("header");
  const tk = useTranslations("search");
  const q = query.trim();
  if (q.length < MIN_LENGTH) {
    return <p className="footnote px-4 py-3 text-(--ink-muted)">{t("searchTyping")}</p>;
  }
  return (
    <div className="flex flex-col">
      <p className="sr-only" role="status">
        {status === "done" ? tk("results", { count: hits.length, query: q }) : ""}
      </p>
      {status === "error" && (
        <p className="footnote px-4 py-3 text-(--ink-muted)">{t("searchError")}</p>
      )}
      {status === "done" && hits.length === 0 && (
        <p className="footnote px-4 py-3 text-(--ink-muted)">{t("searchNone")}</p>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label={t("searchResults")}
        className="flex flex-col p-1.5"
      >
        {hits.map((hit, index) => (
          <li key={hit.href} role="option" aria-selected={index === activeIndex}>
            <Link
              id={`${listId}-${index}`}
              href={hit.href}
              onClick={onPick}
              tabIndex={-1}
              className={`flex min-h-(--touch-target) flex-col justify-center gap-0.5 rounded-(--radius-sm) px-2.5 py-2 text-(--ink) no-underline ${
                index === activeIndex ? "bg-(--surface-raised)" : "hover:bg-(--surface-raised)"
              }`}
            >
              <span className="label text-(--ink-muted) uppercase">
                {tk(`kinds.${hit.kind}`)}
                {hit.area && ` · ${tk("inArea", { number: hit.area.number, name: hit.area.name })}`}
              </span>
              <span className="subheadline font-semibold break-words">{hit.title}</span>
              {hit.snippet && (
                <span className="footnote line-clamp-1 text-(--ink-muted)">{hit.snippet}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        id={`${listId}-${hits.length}`}
        href={allHref(q)}
        onClick={onPick}
        tabIndex={-1}
        className={`subheadline flex min-h-(--touch-target) items-center gap-2 border-t border-(--hairline) px-4 text-(--brand-blue-ink) no-underline ${
          activeIndex === hits.length ? "bg-(--surface-raised)" : ""
        }`}
      >
        <Icon name="search" size={18} />
        {t("searchAll", { query: q })}
      </Link>
    </div>
  );
}

/**
 * The search field of the header (ADR 0035). From 768 px a field in the middle of the header with a
 * results panel under it; on phones an icon that opens the same search over the whole screen. Without
 * JavaScript it is a plain GET form to /hladat. ⌘K / Ctrl+K opens it, Esc closes it.
 */
export function HeaderSearch() {
  const t = useTranslations("header");
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const [query, setQuery] = useState("");
  // open for the page it was opened on – a page change closes it
  const [openOn, setOpenOn] = useState<{ path: string; mode: "panel" | "screen" } | null>(null);
  const open = openOn?.path === pathname ? openOn.mode : null;
  const [activeIndex, setActiveIndex] = useState(-1);
  const { hits, status } = useLiveSearch(open ? query : "");
  const field = useRef<HTMLInputElement>(null);
  const phoneField = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpenOn(null);
    setActiveIndex(-1);
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (window.matchMedia("(min-width: 768px)").matches) field.current?.focus();
      else setOpenOn({ path: window.location.pathname, mode: "screen" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open !== "panel") return;
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open === "screen") phoneField.current?.focus();
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = query.trim().length >= MIN_LENGTH ? hits.length + 1 : 0;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      if (open === "panel") field.current?.blur();
    } else if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? count - 1 : index - 1));
    } else if (event.key === "Enter") {
      const q = query.trim();
      if (!q) return;
      event.preventDefault();
      const target =
        activeIndex >= 0 && activeIndex < hits.length ? hits[activeIndex].href : allHref(q);
      close();
      router.push(target);
    }
  };

  const onChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
  };

  const activeDescendant = activeIndex >= 0 && open ? `${listId}-${activeIndex}` : undefined;

  return (
    <>
      {/* desktop: field in the header, results under it */}
      <div ref={wrap} className="relative hidden min-w-0 flex-[0_1_560px] md:block">
        <form action={SEARCH_PATH} method="get" role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="header-search" className="sr-only">
            {t("searchOpen")}
          </label>
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--ink-muted)"
          >
            <Icon name="search" size={18} />
          </span>
          <input
            ref={field}
            id="header-search"
            name="q"
            type="search"
            autoComplete="off"
            placeholder={t("searchOpen")}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpenOn({ path: pathname, mode: "panel" })}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open === "panel"}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            className="subheadline h-10 w-full rounded-(--radius-pill) border border-(--hairline) bg-(--surface-raised) pr-14 pl-9 text-(--ink) placeholder:text-(--ink-muted) focus:border-(--brand-blue) focus:bg-(--input-bg) focus:shadow-(--shadow-focus) focus:outline-none"
          />
          <kbd
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-(--radius-xs) border border-(--border) px-1.5 font-mono text-xs text-(--ink-muted)"
          >
            {t("searchShortcut")}
          </kbd>
        </form>
        {open === "panel" && (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-(--z-drawer) overflow-hidden rounded-(--radius-md) bg-(--surface) shadow-(--shadow-modal)">
            <Results
              query={query}
              hits={hits}
              status={status}
              activeIndex={activeIndex}
              listId={listId}
              onPick={close}
            />
          </div>
        )}
      </div>

      {/* phone: icon in the header (a link to /hladat without JavaScript), search over the whole screen */}
      <a
        href={SEARCH_PATH}
        aria-label={t("searchOpen")}
        title={t("searchOpen")}
        onClick={(event) => {
          event.preventDefault();
          setOpenOn({ path: pathname, mode: "screen" });
        }}
        className="sfz-btn sfz-btn--icon sfz-btn--tertiary sfz-btn--md md:hidden"
      >
        <Icon name="search" size={20} />
      </a>
      {open === "screen" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("searchOpen")}
          className="fixed inset-0 z-(--z-modal) flex flex-col bg-(--surface) pt-[env(safe-area-inset-top)] text-(--ink) md:hidden"
        >
          <form
            action={SEARCH_PATH}
            method="get"
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="flex items-center gap-2 border-b border-(--hairline) px-3 py-2"
          >
            <IconButton icon="chevron-left" label={t("searchClose")} onClick={close} />
            <label htmlFor="header-search-phone" className="sr-only">
              {t("searchOpen")}
            </label>
            <input
              ref={phoneField}
              id="header-search-phone"
              name="q"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t("searchOpen")}
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeDescendant}
              className="body h-11 min-w-0 flex-1 rounded-(--radius-pill) border border-(--hairline) bg-(--surface-raised) px-4 text-(--ink) placeholder:text-(--ink-muted) focus:border-(--brand-blue) focus:outline-none"
            />
          </form>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            <Results
              query={query}
              hits={hits}
              status={status}
              activeIndex={activeIndex}
              listId={listId}
              onPick={close}
            />
          </div>
        </div>
      )}
    </>
  );
}
