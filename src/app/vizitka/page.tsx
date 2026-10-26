import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { VizitkyExplorer } from "@/components/vizitka/vizitky-explorer";
import { defaultMessages } from "@/i18n/config";
import { vizitkaDeps } from "@/server/clubs/deps";
import { listVizitky } from "@/server/services/vizitky.service";

export const metadata: Metadata = { title: defaultMessages.vizitky.title };

type Props = PageProps<"/vizitka">;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Vizitky klubov – public map, list and rankings of the pilot clubs' Vizitky (VK-a, VK-b). */
async function Vizitky({ searchParams }: Props) {
  await connection(); // public page, rendered per request
  const t = await getTranslations("vizitky");
  const q = await searchParams;
  const cards = await listVizitky(vizitkaDeps);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">{t("intro")}</p>
      </header>
      <VizitkyExplorer
        cards={cards}
        initial={{
          q: str(q.q),
          rfz: str(q.rfz),
          obfz: str(q.obfz),
          size: str(q.size),
          sort: str(q.sort),
        }}
      />
    </div>
  );
}

export default function VizitkyPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Vizitky {...props} />
      </Suspense>
    </main>
  );
}
