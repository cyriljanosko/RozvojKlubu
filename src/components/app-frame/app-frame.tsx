import Image from "next/image";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import logoColour from "@slovensky-futbalovy-zvaz/design-system/brand/logos/Loga-SFZ/sfz-D-farebne.svg";
import logoWhite from "@slovensky-futbalovy-zvaz/design-system/brand/logos/Loga-SFZ/sfz-D-biele.svg";

import {
  AppNavBar,
  AppTabBar,
  Avatar,
  LinkButton,
  MenuSheetButton,
  type MenuSheetSection,
} from "@/components/sfz";
import { buildNavigation, menuSections } from "@/lib/navigation";

import { FrameBreadcrumbs } from "./frame-breadcrumbs";
import { HeaderSearch } from "./header-search";
import { loadFrameUser, toLinks } from "./nav-data";

/** SFZ logo, horizontal variant D; the white one in the dark theme (ADR 0016). */
async function Brand() {
  const t = await getTranslations("header");
  return (
    <>
      <Image
        src={logoColour}
        alt={t("logoAlt")}
        width={75}
        height={36}
        unoptimized
        priority
        className="h-9 w-auto dark:hidden"
      />
      <Image
        src={logoWhite}
        alt={t("logoAlt")}
        width={75}
        height={36}
        unoptimized
        priority
        className="hidden h-9 w-auto dark:block"
      />
      {/* the wordmark only where the header has room (ADR 0035) */}
      <span className="headline ml-2.5 hidden text-(--ink) sm:inline">{t("wordmark")}</span>
    </>
  );
}

/**
 * App frame (R3.3, ADR 0035): menu button · logo · search · account in one header row, the
 * breadcrumb under it, the TabBar with "Menu" below 768 px. Items come from the navigation model
 * (src/lib/navigation.ts). Reads the session, so it renders inside <Suspense>.
 */
export async function AppFrame() {
  const [t, th, frame] = await Promise.all([
    getTranslations("nav"),
    getTranslations("header"),
    headers().then(loadFrameUser),
  ]);
  const nav = buildNavigation(frame.context);
  const clubName = (clubId: string | null) =>
    frame.clubs.find((club) => club.clubId === clubId)?.name ?? null;

  const [tabs, more, sections] = await Promise.all([
    toLinks(nav.tabs),
    toLinks(nav.more),
    Promise.all(
      menuSections(frame.context).map(async (section): Promise<MenuSheetSection> => ({
        id: section.id,
        // the club column carries the club's name
        title: (section.id === "club" && clubName(nav.activeClubId)) || t(section.titleKey),
        items: await toLinks(section.items),
      })),
    ),
  ]);
  const menuLabels = { title: t("allSections"), close: t("closeMenu"), escCloses: t("escCloses") };
  const hasMenuTab = nav.tabs.some((tab) => tab.id === "more");

  // Accounts from the e-mail link may have no name yet; the avatar then uses the e-mail
  const displayName = frame.user ? frame.user.name.trim() || frame.user.email : "";

  const actions = frame.user ? (
    <Link
      href="/ucet"
      aria-label={t("account")}
      title={displayName}
      className="inline-flex size-(--touch-target) items-center justify-center rounded-full"
    >
      <Avatar name={displayName} src={frame.user.image ?? undefined} size="sm" />
    </Link>
  ) : (
    <LinkButton href="/prihlasenie" size="sm" variant="secondary">
      {th("signIn")}
    </LinkButton>
  );

  return (
    <>
      <AppNavBar
        brand={<Brand />}
        brandHref={nav.home}
        brandLabel={th("brand")}
        // phones with the Menu tab open the menu there; visitors have no such tab
        start={
          <MenuSheetButton
            sections={sections}
            labels={menuLabels}
            fallbackHref="/viac"
            className={hasMenuTab ? "max-md:hidden" : "-ml-2.5"}
          />
        }
        center={<HeaderSearch />}
        actions={actions}
      />
      <FrameBreadcrumbs
        signedIn={Boolean(frame.user)}
        names={{ clubs: Object.fromEntries(frame.clubs.map((c) => [c.clubId, c.name])) }}
      />
      <AppTabBar
        items={tabs.map((tab) => ({ ...tab, icon: tab.icon ?? "home" }))}
        navLabel={t("tabsLabel")}
        more={more}
        menu={hasMenuTab ? { sections, labels: menuLabels } : undefined}
      />
    </>
  );
}

/** Static stand-in while the session loads: the bar with the logo only, so the page does not jump. */
export async function AppFrameFallback() {
  const th = await getTranslations("header");
  return (
    <header className="sfz-navbar sfz-navbar--light print:hidden">
      <div className="sfz-navbar__inner gap-2 md:gap-3">
        {/* room of the menu button, so the logo does not move when the frame arrives */}
        <span aria-hidden className="hidden size-(--touch-target) md:block" />
        <Link className="sfz-navbar__brand" href="/" aria-label={th("brand")}>
          <Brand />
        </Link>
      </div>
    </header>
  );
}
