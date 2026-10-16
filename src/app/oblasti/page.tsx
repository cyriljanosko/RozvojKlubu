import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listAreas } from "@/server/services/content.service";

export const metadata: Metadata = { title: defaultMessages.areas.title };

const BAND_COLOR = { 1: "bg-blue-600", 2: "bg-amber-600", 3: "bg-zinc-500" } as const;

async function AreaList() {
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("areas");
  const areas = await listAreas(mongoContentStore, user);
  if (areas.length === 0) return <p className="text-muted-foreground text-sm">{t("empty")}</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {areas.map((area) => (
        <li key={area.number}>
          <Link
            href={`/oblasti/${area.number}`}
            className="hover:bg-muted/50 flex h-full gap-3 rounded-xl border p-4"
          >
            <span
              className={`${BAND_COLOR[area.band]} flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white`}
            >
              {area.number}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold break-words">{area.name}</span>
              <span className="text-muted-foreground text-xs">{t(`bands.${area.band}`)}</span>
              <span className="text-muted-foreground text-sm">{area.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AreasPage() {
  const t = await getTranslations("areas");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl">{t("intro")}</p>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AreaList />
      </Suspense>
    </main>
  );
}
