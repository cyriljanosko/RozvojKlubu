import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AreaLineList } from "@/components/areas/area-lines";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { listAreas } from "@/server/services/content.service";

export const metadata: Metadata = { title: defaultMessages.areas.title };

/** The 11 areas grouped by the lines of the eleven (R4 G1a, approved design R2a). */
async function AreaList() {
  await connection(); // public page: render per request (session optional, ADR 0011)
  const user = await getCurrentUser(await headers());
  const t = await getTranslations("areas");
  const areas = await listAreas(mongoContentStore, user);
  if (areas.length === 0) return <p className="body text-(--ink-muted)">{t("empty")}</p>;

  return (
    <AreaLineList
      areas={areas.map((area) => ({
        number: area.number,
        name: area.name,
        text: area.description,
        href: `/oblasti/${area.number}`,
      }))}
    />
  );
}

export default async function AreasPage() {
  const t = await getTranslations("areas");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="large-title">{t("title")}</h1>
        <p className="body max-w-2xl text-(--ink-muted)">{t("intro")}</p>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AreaList />
      </Suspense>
    </main>
  );
}
