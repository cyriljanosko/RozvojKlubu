import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { loadFrameUser, toLinks } from "@/components/app-frame/nav-data";
import { SignOut } from "@/components/app-frame/sign-out";
import { Icon, LinkButton } from "@/components/sfz";
import { buildNavigation, menuSections } from "@/lib/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("moreTitle") };
}

/** The whole menu as a page (ADR 0035): where the Menu button and tab lead without JavaScript. */
export default function MorePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <Suspense fallback={null}>
        <MoreMenu />
      </Suspense>
    </main>
  );
}

async function MoreMenu() {
  const [t, th, frame] = await Promise.all([
    getTranslations("nav"),
    getTranslations("header"),
    headers().then(loadFrameUser),
  ]);
  const nav = buildNavigation(frame.context);
  const clubName = frame.clubs.find((club) => club.clubId === nav.activeClubId)?.name;
  const sections = await Promise.all(
    menuSections(frame.context).map(async (section) => ({
      id: section.id,
      title: (section.id === "club" && clubName) || t(section.titleKey),
      links: await toLinks(section.items),
    })),
  );

  return (
    <>
      <h1 className="large-title">{t("moreTitle")}</h1>
      {sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`more-${section.id}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`more-${section.id}`} className="label px-1 text-(--ink-muted) uppercase">
            {section.title}
          </h2>
          <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
            {section.links.map((link) => (
              <li key={link.id} className="border-b border-(--hairline) last:border-b-0">
                <Link
                  href={link.href}
                  className="flex min-h-13 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
                >
                  {link.icon && <Icon name={link.icon} size={20} />}
                  <span className="body flex-1">{link.label}</span>
                  <span className="text-(--ink-muted)">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {frame.user ? (
        <SignOut />
      ) : (
        <LinkButton href="/prihlasenie" block>
          {th("signIn")}
        </LinkButton>
      )}
    </>
  );
}
