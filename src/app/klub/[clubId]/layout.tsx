import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { loadFrameUser, toLinks } from "@/components/app-frame/nav-data";
import { Avatar, LinkTabs } from "@/components/sfz";
import { clubMenu } from "@/lib/navigation";

/**
 * Club frame (R3.3, analysis 4.2): club header and sub-menu above every club page.
 * Pages keep their own content and access checks; someone without a role in the club
 * gets no sub-menu and sees the page's own "no access" message.
 */
export default function ClubLayout({ children, params }: LayoutProps<"/klub/[clubId]">) {
  return (
    <>
      <Suspense fallback={null}>
        <ClubHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function ClubHeader({ params }: { params: LayoutProps<"/klub/[clubId]">["params"] }) {
  const { clubId: rawId } = await params;
  const clubId = decodeURIComponent(rawId);
  const [t, tRoles, frame] = await Promise.all([
    getTranslations("nav"),
    getTranslations("clubRoles"),
    headers().then(loadFrameUser),
  ]);
  const club = frame.clubs.find((entry) => entry.clubId === clubId);
  if (!frame.user || !club) return null;

  const items = clubMenu(encodeURIComponent(clubId), club.roles, frame.context.isAdmin);
  if (items.length === 0) return null;
  const links = await toLinks(items);

  return (
    <div className="border-b border-(--hairline) bg-(--surface) print:hidden">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar name={club.name} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="title-3 truncate">{club.name}</span>
            <span className="footnote truncate text-(--ink-muted)">
              {[club.union, ...club.roles.map((role) => tRoles(role))].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
        <LinkTabs items={links} navLabel={t("clubLabel")} />
      </div>
    </div>
  );
}
