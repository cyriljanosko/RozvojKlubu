import Image from "next/image";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import logoColour from "@slovensky-futbalovy-zvaz/design-system/brand/logos/Loga-SFZ/sfz-D-farebne.svg";
import logoWhite from "@slovensky-futbalovy-zvaz/design-system/brand/logos/Loga-SFZ/sfz-D-biele.svg";

import { AppNavBar, AppTabBar, Avatar, LinkButton, LinkIconButton } from "@/components/sfz";
import { buildNavigation } from "@/lib/navigation";

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
    </>
  );
}

/**
 * App frame of the redesign (R3.3): NavBar from 768 px, TabBar below it, items from the
 * navigation model (src/lib/navigation.ts). Reads the session, so it renders inside <Suspense>.
 */
export async function AppFrame() {
  const [t, th, frame] = await Promise.all([
    getTranslations("nav"),
    getTranslations("header"),
    headers().then(loadFrameUser),
  ]);
  const nav = buildNavigation(frame.context);
  const [main, tabs] = await Promise.all([toLinks(nav.main), toLinks(nav.tabs)]);

  // Accounts from the e-mail link may have no name yet; the avatar then uses the e-mail
  const displayName = frame.user ? frame.user.name.trim() || frame.user.email : "";

  const actions = (
    <>
      <LinkIconButton href="/hladat" icon="search" label={t("search")} />
      {frame.user ? (
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
      )}
    </>
  );

  return (
    <>
      <AppNavBar
        brand={<Brand />}
        brandHref={nav.home}
        brandLabel={th("brand")}
        items={main}
        actions={actions}
        navLabel={t("mainLabel")}
      />
      <AppTabBar
        items={tabs.map((tab) => ({ ...tab, icon: tab.icon ?? "home" }))}
        navLabel={t("tabsLabel")}
      />
    </>
  );
}

/** Static stand-in while the session loads: the bar with the logo only, so the page does not jump. */
export async function AppFrameFallback() {
  const th = await getTranslations("header");
  return (
    <header className="sfz-navbar sfz-navbar--light print:hidden">
      <div className="sfz-navbar__inner">
        <Link className="sfz-navbar__brand" href="/" aria-label={th("brand")}>
          <Brand />
        </Link>
      </div>
    </header>
  );
}
