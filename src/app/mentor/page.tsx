import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { submissionDeps } from "@/server/clubs/deps";
import { listMentorClubs } from "@/server/services/kompas-submission.service";

export const metadata: Metadata = { title: defaultMessages.mentor.title };

async function Mentor() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("mentor");

  let rows;
  try {
    rows = await listMentorClubs(submissionDeps, user);
  } catch (error) {
    if (error instanceof ApiError && error.code === "FORBIDDEN") {
      return <p className="text-sm">{t("forbidden")}</p>;
    }
    throw error;
  }
  const date = (d: Date) =>
    d.toLocaleDateString("sk", { dateStyle: "medium", timeZone: "Europe/Bratislava" });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("intro")}</p>
      </header>
      <ul className="divide-y rounded-md border">
        {rows.map((r) => (
          <li key={r.clubId} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
            <span className="font-medium break-words">{r.name}</span>
            <span className="text-muted-foreground text-xs">{r.union}</span>
            {r.latest ? (
              <Link
                href={`/klub/${encodeURIComponent(r.clubId)}/kompas/odoslane/${r.latest.id}`}
                className="underline underline-offset-4"
              >
                {t("latest", {
                  date: date(r.latest.submittedAt),
                  total: r.latest.total,
                  filled: r.latest.filledAreas,
                })}
              </Link>
            ) : (
              <span className="text-muted-foreground">{t("none")}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MentorPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Mentor />
      </Suspense>
    </main>
  );
}
