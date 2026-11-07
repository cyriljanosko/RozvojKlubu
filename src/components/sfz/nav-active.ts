/** A navigation link of the app frame (NavBar, TabBar, sub-menus). Plain data, safe to pass from server components. */
export interface NavLink {
  id: string;
  label: string;
  href: string;
  /** Design-system icon name (TabBar requires one). */
  icon?: string;
  /** "exact": active only on this URL; "prefix" (default): also on its sub-pages. */
  match?: "exact" | "prefix";
}

function stripQuery(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

/** True when `link` should be marked as the current page for `pathname`. */
export function isActiveLink(pathname: string, link: Pick<NavLink, "href" | "match">): boolean {
  const target = stripQuery(link.href).replace(/\/$/, "") || "/";
  const path = pathname.replace(/\/$/, "") || "/";
  if (link.match === "exact" || target === "/") return path === target;
  return path === target || path.startsWith(`${target}/`);
}

/** The id of the most specific active link (longest href wins), or null. */
export function activeLinkId(pathname: string, links: readonly NavLink[]): string | null {
  let best: NavLink | null = null;
  for (const link of links) {
    if (!isActiveLink(pathname, link)) continue;
    if (!best || stripQuery(link.href).length > stripQuery(best.href).length) best = link;
  }
  return best?.id ?? null;
}

/**
 * The active TabBar item: a direct match first; otherwise `moreId` ("Viac") when the page belongs to
 * a section opened from the "Viac" menu (its first path segment, e.g. the whole /admin for
 * Administrácia → /admin/kluby). G5: the administration keeps Viac active.
 */
export function activeTabId(
  pathname: string,
  tabs: readonly NavLink[],
  more: readonly NavLink[],
  moreId = "more",
): string | null {
  const direct = activeLinkId(pathname, tabs);
  if (direct || !tabs.some((tab) => tab.id === moreId)) return direct;
  const section = (href: string) => `/${stripQuery(href).split("/")[1] ?? ""}`;
  return more.some((link) => isActiveLink(pathname, { href: section(link.href) })) ? moreId : null;
}
