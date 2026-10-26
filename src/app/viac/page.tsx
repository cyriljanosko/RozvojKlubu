import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { loadFrameUser, toLinks } from "@/components/app-frame/nav-data";
import { SignOut } from "@/components/app-frame/sign-out";
import { Icon, LinkButton } from "@/components/sfz";
import { buildNavigation } from "@/lib/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("moreTitle") };
}

/** "Viac" – the rest of the menu on phones (TabBar has five items at most; analysis 4.1). */
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
  const links = await toLinks(buildNavigation(frame.context).more);

  return (
    <>
      <h1 className="large-title">{t("moreTitle")}</h1>
      <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
        {links.map((link) => (
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
