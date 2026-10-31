import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SignOut } from "@/components/app-frame/sign-out";
import { ThemeSelect } from "@/components/app-frame/theme";
import { Avatar, Badge, Card, Icon } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { clubDeps } from "@/server/clubs/deps";
import { isAdmin } from "@/server/services/club-access";
import { listMyClubs } from "@/server/services/clubs.service";

export const metadata: Metadata = { title: defaultMessages.account.title };

async function Account() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("account");
  const tRoles = await getTranslations("roles");
  const tClubRoles = await getTranslations("clubRoles");
  const tHeader = await getTranslations("header");
  const clubs = await listMyClubs(clubDeps, user);
  const admin = isAdmin(user);
  const mentor = admin || clubs.some((c) => c.roles.includes("mentor"));
  const tMentor = await getTranslations("mentor");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <Avatar name={user.name || user.email} size="xl" />
        <h1 className="title-2 break-words">{user.name || user.email}</h1>
        {user.name && (
          <span className="subheadline break-all text-(--ink-muted)">{user.email}</span>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {user.sportnetId ? (
            <Badge tone="success" dot>
              {t("sportnetLinked")}
            </Badge>
          ) : (
            <Badge tone="neutral">{t("sportnetNotLinked")}</Badge>
          )}
          {user.role !== "public" && <Badge tone="brand">{tRoles(user.role)}</Badge>}
        </div>
      </header>

      <section className="flex flex-col gap-2" aria-labelledby="my-clubs">
        <h2 id="my-clubs" className="label text-(--ink-muted) uppercase">
          {admin ? t("allClubs") : t("myClubsRoles")}
        </h2>
        {clubs.length > 0 ? (
          <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
            {clubs.map((club) => (
              <li key={club.clubId} className="border-t border-(--hairline) first:border-t-0">
                <Link
                  href={`/klub/${encodeURIComponent(club.clubId)}`}
                  className="flex min-h-15 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
                >
                  <Avatar name={club.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="body break-words">{club.name}</span>
                    <span className="footnote text-(--ink-muted)">
                      {[club.union, ...club.roles.map((r) => tClubRoles(r))].join(" · ")}
                    </span>
                  </span>
                  <span className="text-(--ink-muted)" aria-hidden>
                    <Icon name="chevron-right" size={18} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="callout rounded-(--radius-md) bg-(--surface-raised) p-4 text-(--ink-muted)">
            {t("noClubs")} {t("roleHint")}
          </p>
        )}
        {clubs.length > 0 && <p className="footnote text-(--ink-muted)">{t("rolesSource")}</p>}
      </section>

      {(mentor || admin) && (
        <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
          {mentor && <Row href="/mentor" label={tMentor("link")} />}
          {admin && <Row href="/admin/kluby" label={tHeader("admin")} />}
          {admin && <Row href="/admin/obsah" label={tHeader("content")} />}
        </ul>
      )}

      <Card title={t("settings")}>
        <ThemeSelect />
      </Card>

      <SignOut />
    </div>
  );
}

function Row({ href, label }: { href: string; label: string }) {
  return (
    <li className="border-t border-(--hairline) first:border-t-0">
      <Link
        href={href}
        className="flex min-h-13 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
      >
        <span className="body flex-1">{label}</span>
        <span className="text-(--ink-muted)" aria-hidden>
          <Icon name="chevron-right" size={18} />
        </span>
      </Link>
    </li>
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Account />
      </Suspense>
    </main>
  );
}
