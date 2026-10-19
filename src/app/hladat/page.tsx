import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SearchForm } from "@/components/search/search-form";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { searchDeps } from "@/server/clubs/deps";
import { isDatabaseConfigured } from "@/server/db/mongo";
import { search, type SearchKind } from "@/server/services/search.service";

export const metadata: Metadata = { title: defaultMessages.search.title };

const KINDS: SearchKind[] = ["area", "section", "practice", "template", "club"];

async function Results({ searchParams }: PageProps<"/hladat">) {
  await connection();
  const t = await getTranslations("search");
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw : "";
  const user = isDatabaseConfigured()
    ? await getCurrentUser(await headers()).catch(() => null)
    : null;
  const { query, hits } = await search(searchDeps, user, q);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <SearchForm defaultValue={query} tips={hits.length === 0} />
      </header>
      {query && (
        <p className="text-muted-foreground text-sm" role="status">
          {hits.length > 0 ? t("results", { count: hits.length, query }) : t("none", { query })}
        </p>
      )}
      {KINDS.map((kind) => {
        const group = hits.filter((h) => h.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} aria-labelledby={`kind-${kind}`} className="flex flex-col gap-2">
            <h2 id={`kind-${kind}`} className="font-semibold">
              {t(`kinds.${kind}`)} <span className="text-muted-foreground">· {group.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {group.map((h) => (
                <li key={h.href}>
                  <Link
                    href={h.href}
                    className="hover:bg-muted/50 flex flex-col gap-0.5 rounded-lg border p-3 text-sm"
                  >
                    <span className="font-medium break-words">{h.title}</span>
                    {h.area && (
                      <span className="text-muted-foreground text-xs">
                        {t("inArea", { number: h.area.number, name: h.area.name })}
                      </span>
                    )}
                    {h.snippet && (
                      <span className="text-muted-foreground line-clamp-2 break-words">
                        {h.snippet}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function SearchPage(props: PageProps<"/hladat">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Results {...props} />
      </Suspense>
    </main>
  );
}
