import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { loadFrameUser, toLinks } from "@/components/app-frame/nav-data";
import { Avatar, Badge, Icon, LinkTabs } from "@/components/sfz";
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

  const others = frame.clubs.filter((entry) => entry.clubId !== clubId);

  return (
    <div className="border-b border-(--hairline) bg-(--surface) print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={club.name} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="title-2 break-words">{club.name}</span>
            {club.union && <span className="footnote text-(--ink-muted)">{club.union}</span>}
          </div>
          {others.length > 0 && (
            // native disclosure: switching the club works without JavaScript
            <details className="group relative">
              <summary className="sfz-btn sfz-btn--tertiary sfz-btn--sm list-none [&::-webkit-details-marker]:hidden">
                {t("switchClub")}
                <span
                  className="inline-flex transition-transform group-open:rotate-180"
                  aria-hidden
                >
                  <Icon name="chevron-down" size={16} />
                </span>
              </summary>
              <ul className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-(--radius-md) border border-(--hairline) bg-(--surface-raised)">
                {others.map((entry) => (
                  <li key={entry.clubId} className="border-t border-(--hairline) first:border-t-0">
                    <Link
                      href={`/klub/${encodeURIComponent(entry.clubId)}`}
                      className="subheadline flex min-h-(--touch-target) items-center px-4 py-2 text-(--ink) no-underline"
                    >
                      {entry.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {club.roles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {club.roles.map((role) => (
              <Badge key={role} tone="brand">
                {tRoles(role)}
              </Badge>
            ))}
          </div>
        )}
        <LinkTabs items={links} navLabel={t("clubLabel")} />
      </div>
    </div>
  );
}
