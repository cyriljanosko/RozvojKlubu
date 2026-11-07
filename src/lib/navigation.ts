import { CLUB_MEMBER_ROLES, COACH_LEVEL_ROLES } from "@/lib/club-roles";
import type { ClubRole } from "@/server/db/types";

/**
 * Navigation model of the redesigned app frame (analysis of screens, chapter 4; R3.2).
 * Pure functions: who sees which item in the NavBar (desktop), TabBar (mobile, max. 5),
 * the "Viac" menu, the club sub-menu and the admin menu. Labels are next-intl keys
 * in the `nav` namespace; the frame translates them. Only routes that exist today are
 * listed – club members/settings, the admin code lists and the Sportnet page arrive with R4/S3.
 */

export interface NavItem {
  id: string;
  /** Key in the `nav` messages namespace. */
  labelKey: string;
  href: string;
  /** Design-system icon name; every TabBar item has one. */
  icon?: string;
  /** "exact": active only on this URL; default: also on its sub-pages. */
  match?: "exact" | "prefix";
}

/** A club the signed-in person belongs to in the current season, with their roles there. */
export interface NavClub {
  clubId: string;
  roles: readonly ClubRole[];
}

export interface NavContext {
  signedIn: boolean;
  /** Global role admin_sfz. */
  isAdmin: boolean;
  clubs: readonly NavClub[];
  /** Club picked in the club switcher; defaults to the first club with a role other than mentor. */
  activeClubId?: string | null;
}

export interface Navigation {
  /** Where the logo and "Domov" lead. */
  home: string;
  /** NavBar (from 768 px). */
  main: NavItem[];
  /** TabBar (below 768 px), at most five items. */
  tabs: NavItem[];
  /** The "Viac" menu (mobile) and the account menu (desktop). */
  more: NavItem[];
  /** The club whose overview "Môj klub" opens, if any. */
  activeClubId: string | null;
}

/** Roles that may open the club's own Kompas (kompas.service: mentor sees only submitted ones). */
const KOMPAS_ROLES: readonly ClubRole[] = ["club_manager", ...COACH_LEVEL_ROLES];
/** Licensing and mentoring: not for players and members (analysis 3.2). */
const STAFF_ROLES: readonly ClubRole[] = ["club_manager", ...COACH_LEVEL_ROLES, "mentor"];
/** Roles with the analytics workspace in the menu (analysis 3.2: management, mentor, admin). */
const ANALYTICS_ROLES: readonly ClubRole[] = ["club_manager", "mentor"];
/** Roles that see the club's Novinky proposals (news.service: coaches have no access). */
const NEWS_ROLES: readonly ClubRole[] = ["club_manager", "mentor"];

const has = (roles: readonly ClubRole[], wanted: readonly ClubRole[]) =>
  roles.some((role) => wanted.includes(role));

const allRoles = (clubs: readonly NavClub[]) => clubs.flatMap((club) => club.roles);

/** Clubs where the person has a role in the club itself (not only the mentor). */
export function ownClubs(clubs: readonly NavClub[]): NavClub[] {
  return clubs.filter((club) => has(club.roles, CLUB_MEMBER_ROLES));
}

export function isMentor(clubs: readonly NavClub[]): boolean {
  return clubs.some((club) => club.roles.includes("mentor"));
}

function pickActiveClub(ctx: NavContext): NavClub | null {
  const own = ownClubs(ctx.clubs);
  return own.find((club) => club.clubId === ctx.activeClubId) ?? own[0] ?? null;
}

const item = (id: string, href: string, icon?: string, match?: NavItem["match"]): NavItem => ({
  id,
  labelKey: id,
  href,
  ...(icon && { icon }),
  ...(match && { match }),
});

const AREAS = item("areas", "/oblasti", "file-text");
const CLUBS = item("clubs", "/vizitka", "trophy");
const TRIAL_KOMPAS = item("kompas", "/kompas", "check-circle");

/** Main navigation for the current person (see the analysis, chapter 4.1). */
export function buildNavigation(ctx: NavContext): Navigation {
  if (!ctx.signedIn) {
    return {
      home: "/",
      main: [
        item("academy", "/", "home"),
        AREAS,
        TRIAL_KOMPAS,
        CLUBS,
        item("about", "/o-akademii", "info"),
      ],
      tabs: [
        item("academy", "/", "home"),
        AREAS,
        TRIAL_KOMPAS,
        CLUBS,
        item("signIn", "/prihlasenie", "user"),
      ],
      more: [
        item("news", "/novinky", "bell"),
        item("search", "/hladat", "search"),
        item("about", "/o-akademii", "info"),
      ],
      activeClubId: null,
    };
  }

  const club = pickActiveClub(ctx);
  const mentor = isMentor(ctx.clubs);
  const roles = allRoles(ctx.clubs);
  const home = item("home", "/moja-akademia", "home");
  const myClub = club ? item("myClub", `/klub/${club.clubId}`, "users") : null;
  const mentorClubs = mentor ? item("mentorClubs", "/mentor", "users") : null;
  const kompas =
    club && has(club.roles, KOMPAS_ROLES)
      ? item("kompas", `/klub/${club.clubId}/kompas`, "check-circle")
      : TRIAL_KOMPAS;
  const analytics =
    ctx.isAdmin || has(roles, ANALYTICS_ROLES) ? item("analytics", "/analyza", "file-text") : null;
  const admin = ctx.isAdmin ? item("admin", "/admin/kluby", "settings") : null;
  // "Menu" opens the menu sheet; without JavaScript it is a link to /viac (ADR 0035)
  const moreLink: NavItem = { id: "more", labelKey: "menu", href: "/viac", icon: "menu" };

  const more = [
    item("account", "/ucet", "user"),
    CLUBS,
    item("news", "/novinky", "bell"),
    item("search", "/hladat", "search"),
    item("about", "/o-akademii", "info"),
    analytics,
    mentor || ctx.isAdmin ? item("mentorWorkspace", "/mentor", "calendar") : null,
    admin,
  ].filter((entry): entry is NavItem => entry !== null);

  if (ctx.isAdmin) {
    return {
      home: home.href,
      main: [home, AREAS, CLUBS, analytics!, admin!],
      tabs: [home, AREAS, CLUBS, analytics!, moreLink],
      more,
      activeClubId: club?.clubId ?? null,
    };
  }

  const second = myClub ?? mentorClubs;
  return {
    home: home.href,
    main: [home, second, AREAS, kompas, CLUBS].filter((entry): entry is NavItem => entry !== null),
    tabs: [home, second ?? CLUBS, AREAS, kompas, moreLink],
    more,
    activeClubId: club?.clubId ?? null,
  };
}

/**
 * Club sub-menu (analysis, chapter 4.2), filtered by the person's roles in that club.
 * Mentors do not get the club's own Kompas (they see only submitted ones, kompas.service).
 */
export function clubMenu(clubId: string, roles: readonly ClubRole[], isAdmin: boolean): NavItem[] {
  const base = `/klub/${clubId}`;
  const anyRole = isAdmin || roles.length > 0;
  if (!anyRole) return [];
  return [
    item("clubOverview", base, undefined, "exact"),
    isAdmin || has(roles, KOMPAS_ROLES) ? item("clubKompas", `${base}/kompas`) : null,
    item("clubPlan", `${base}/plan`),
    isAdmin || has(roles, STAFF_ROLES)
      ? item("clubLicensing", `${base}/licencne-hodnotenie`)
      : null,
    // visits are part of the mentoring page (decision 29. 10. 2026)
    isAdmin || has(roles, STAFF_ROLES) ? item("clubMentoring", `${base}/mentoring`) : null,
    // club proposals for Novinky: management writes, the mentor reads (ADR 0023)
    isAdmin || has(roles, NEWS_ROLES) ? item("clubNews", `${base}/novinky`) : null,
  ].filter((entry): entry is NavItem => entry !== null);
}

/**
 * Admin side menu (G5, docs/dizajn/g5-poznamky.md). Final order: Prehľad · Kluby · Osoby a členstvá ·
 * Číselníky · Obsah · Novinky · Používatelia · Sportnet – only screens that exist are listed; the others
 * join in that order with S3. The role catalog is reached from Obsah, so Obsah stays active on its pages.
 */
export function adminMenu(): NavItem[] {
  return [
    item("adminClubs", "/admin/kluby", "trophy"),
    item("adminContent", "/admin/obsah", "edit"),
    item("adminNews", "/admin/novinky", "bell"),
    item("adminSportnet", "/admin/sportnet", "arrow-up-down"),
  ];
}

/** A titled group of the menu sheet (ADR 0035): Hlavné · Môj klub · Ďalšie · Správa. */
export interface MenuSection {
  id: "main" | "club" | "more" | "admin";
  /** Key in the `nav` namespace; the club section is titled with the club's name instead. */
  titleKey: string;
  items: NavItem[];
}

/**
 * The menu sheet in the header (desktop) and behind the "Menu" tab (phone), ADR 0035. It replaces
 * the NavBar row: every place of the app the person may open, grouped, filtered by their roles.
 */
export function menuSections(ctx: NavContext): MenuSection[] {
  const nav = buildNavigation(ctx);
  const news = item("news", "/novinky", "bell");
  const about = item("about", "/o-akademii", "info");

  if (!ctx.signedIn) {
    return [
      {
        id: "main",
        titleKey: "sectionMain",
        items: [...nav.main.filter((e) => e.id !== "about"), news],
      },
      {
        id: "more",
        titleKey: "sectionMore",
        items: [about, item("signIn", "/prihlasenie", "user")],
      },
    ];
  }

  const club = pickActiveClub(ctx);
  const roles = allRoles(ctx.clubs);
  const mentor = isMentor(ctx.clubs);
  const main = [
    item("home", "/moja-akademia", "home"),
    AREAS,
    club && has(club.roles, KOMPAS_ROLES) ? null : TRIAL_KOMPAS,
    CLUBS,
    news,
  ];
  const more = [
    mentor ? item("mentorClubs", "/mentor", "users") : null,
    ctx.isAdmin || has(roles, ANALYTICS_ROLES) ? item("analytics", "/analyza", "file-text") : null,
    ctx.isAdmin ? item("mentorWorkspace", "/mentor", "calendar") : null,
    item("account", "/ucet", "user"),
    about,
  ];
  const sections: MenuSection[] = [
    { id: "main", titleKey: "sectionMain", items: main.filter((e): e is NavItem => e !== null) },
  ];
  if (club) {
    const items = clubMenu(club.clubId, club.roles, ctx.isAdmin);
    if (items.length > 0) sections.push({ id: "club", titleKey: "myClub", items });
  }
  sections.push({
    id: "more",
    titleKey: "sectionMore",
    items: more.filter((e): e is NavItem => e !== null),
  });
  if (ctx.isAdmin) sections.push({ id: "admin", titleKey: "sectionAdmin", items: adminMenu() });
  return sections;
}

/** One step of the breadcrumb; the last one is the current page and has no link. */
export interface Crumb {
  /** Key in the `nav` namespace, or null when `label` carries a name (club, area). */
  labelKey: string | null;
  label?: string;
  /** Values for the `labelKey` message, e.g. the area number. */
  params?: Record<string, string>;
  href: string | null;
}

/** Names the path cannot carry: clubs the person sees (by Sportnet id) and areas (by number). */
export interface CrumbNames {
  clubs?: Readonly<Record<string, string>>;
  areas?: Readonly<Record<number, string>>;
}

/** Static path segments and their labels; dynamic segments are handled in `breadcrumbs`. */
const SEGMENT_KEYS: Record<string, string> = {
  oblasti: "areas",
  kompas: "kompas",
  vizitka: "crumbVizitka",
  novinky: "news",
  mentor: "mentorWorkspace",
  analyza: "analytics",
  ucet: "account",
  hladat: "search",
  "o-akademii": "about",
  viac: "moreTitle",
  prihlasenie: "signIn",
  admin: "admin",
  kluby: "adminClubs",
  obsah: "adminContent",
  roly: "crumbRoles",
  metodika: "crumbMethodology",
  prax: "crumbPractice",
  sportnet: "adminSportnet",
  plan: "clubPlan",
  "licencne-hodnotenie": "clubLicensing",
  mentoring: "clubMentoring",
  navstevy: "crumbVisits",
  nova: "crumbNewVisit",
};

/** Labels of an id segment by the segment before it (detail pages without a name in the path). */
const DETAIL_KEYS: Record<string, string> = {
  novinky: "crumbNewsItem",
  navstevy: "crumbVisit",
  odoslane: "crumbSubmission",
};

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * Breadcrumb of a page, built from its address and not from the browser history, so it is the same
 * after opening a link from an e-mail (ADR 0035). Empty on the home pages and unknown paths.
 * Admin pages have no /admin overview, so "Administrácia" leads to its first screen.
 */
export function breadcrumbs(pathname: string, signedIn: boolean, names: CrumbNames = {}): Crumb[] {
  const segments = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] === "moja-akademia" || segments[0] === "dev") return [];
  const home: Crumb = signedIn
    ? { labelKey: "home", href: "/moja-akademia" }
    : { labelKey: "academy", href: "/" };

  const crumbs: Crumb[] = [home];
  let href = "";
  segments.forEach((segment, index) => {
    href += `/${segment}`;
    const prev = segments[index - 1];
    const value = decode(segment);
    let crumb: Crumb | null = null;

    if (index === 0 && segment === "klub") return; // /klub has no page; the club name follows
    if (index === 0 && segment === "vizitka") crumb = { labelKey: "clubs", href };
    else if (prev === "klub" || (prev === "kluby" && segments[0] === "admin")) {
      const name = names.clubs?.[value];
      crumb = name ? { labelKey: null, label: name, href } : { labelKey: "crumbClub", href };
    } else if (prev === "vizitka" && index === 1) {
      const name = names.clubs?.[value];
      crumb = name ? { labelKey: null, label: name, href } : { labelKey: "crumbVizitka", href };
    } else if (prev === "oblasti" || (prev === "obsah" && segment !== "roly")) {
      const number = Number(value);
      const name = names.areas?.[number];
      crumb = name
        ? { labelKey: null, label: name, href }
        : { labelKey: "crumbArea", params: { number: value }, href };
    } else if (index === 0 && segment === "admin") {
      // no /admin overview page: the section name is plain text
      crumb = { labelKey: "admin", href: null };
    } else if (SEGMENT_KEYS[segment] && !(prev && DETAIL_KEYS[prev] && segment !== "nova")) {
      crumb = { labelKey: SEGMENT_KEYS[segment], href };
    } else if (prev && DETAIL_KEYS[prev]) {
      crumb = { labelKey: DETAIL_KEYS[prev], href };
    }
    if (crumb) crumbs.push(crumb);
  });

  if (crumbs.length < 2) return [];
  return crumbs.map((crumb, i) => (i === crumbs.length - 1 ? { ...crumb, href: null } : crumb));
}
