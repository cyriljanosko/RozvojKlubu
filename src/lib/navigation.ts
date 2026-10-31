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

/** Roles that work in the club (not the federation mentor). */
const CLUB_MEMBER_ROLES: readonly ClubRole[] = ["management", "coach"];
/** Roles that may open the club's own Kompas (kompas.service: mentor sees only submitted ones). */
const KOMPAS_ROLES: readonly ClubRole[] = ["management", "coach"];
/** Roles with the analytics workspace in the menu (analysis 3.2: management, mentor, admin). */
const ANALYTICS_ROLES: readonly ClubRole[] = ["management", "mentor"];

const has = (roles: readonly ClubRole[], wanted: readonly ClubRole[]) =>
  roles.some((role) => wanted.includes(role));

const allRoles = (clubs: readonly NavClub[]) => clubs.flatMap((club) => club.roles);

/** Clubs where the person has a role in the club itself (management, coach, later players and members). */
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
  const moreLink = item("more", "/viac", "more-horizontal");

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
    item("clubLicensing", `${base}/licencne-hodnotenie`),
    // visits are part of the mentoring page (decision 29. 10. 2026)
    item("clubMentoring", `${base}/mentoring`),
  ].filter((entry): entry is NavItem => entry !== null);
}

/** Admin side menu (analysis, chapter 4.2) – existing screens; code lists and Sportnet come with S3. */
export function adminMenu(): NavItem[] {
  return [
    item("adminClubs", "/admin/kluby", "trophy"),
    item("adminContent", "/admin/obsah", "edit", "exact"),
    item("adminRoles", "/admin/obsah/roly", "users"),
  ];
}
