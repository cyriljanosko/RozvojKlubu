import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { defaultMessages } from "@/i18n/config";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/session";
import { kompasDeps } from "@/server/clubs/deps";
import { mongoContentStore } from "@/server/db/content.store";
import type { QuestionTag } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import { listPublicClubs } from "@/server/services/clubs.service";
import { listAreas } from "@/server/services/content.service";
import { getKompasTemplate } from "@/server/services/kompas.service";
import { currentSeason } from "@/server/services/season";

import { KompasForm } from "../klub/[clubId]/kompas/kompas-form";

export const metadata: Metadata = { title: defaultMessages.trialKompas.title };

type Props = PageProps<"/kompas">;

/** Public trial Kompas (ADR 0011): club → categories from Sportnet, answers only in the browser. */
async function TrialKompas({ searchParams }: Props) {
  await connection();
  const t = await getTranslations("trialKompas");
  const tKompas = await getTranslations("kompas");
  const tTags = await getTranslations("questionTags");
  const { klub } = await searchParams;
  const clubId = typeof klub === "string" ? klub : null;

  if (!clubId) {
    const clubs = await listPublicClubs(kompasDeps);
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm">{t("intro")}</p>
          <p className="text-sm">{t("pick")}</p>
        </header>
        <ul className="grid gap-2 sm:grid-cols-2">
          {clubs.map((c) => (
            <li key={c.clubId}>
              <Link
                href={`/kompas?klub=${encodeURIComponent(c.clubId)}`}
                className="hover:bg-muted/50 flex flex-col rounded-md border px-3 py-2.5 text-sm"
              >
                <span className="font-medium break-words">{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.union}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">{t("pilot")}</p>
      </div>
    );
  }

  let template;
  try {
    template = await getKompasTemplate(kompasDeps, clubId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return <p className="text-sm">{t("notFound")}</p>;
    }
    throw error;
  }
  const [areas, user] = await Promise.all([
    listAreas(mongoContentStore, null),
    getCurrentUser(await headers()),
  ]);
  const roles = user
    ? clubRolesFor(await kompasDeps.memberships.listByUser(user.id), clubId, currentSeason())
    : [];
  const canOpenClub = user !== null && (isAdmin(user) || roles.some((r) => r !== "mentor"));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link href="/kompas" className="text-muted-foreground text-sm underline underline-offset-4">
          {t("change")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {t("title")} · {template.club.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {tKompas("season", { season: template.season })} · {tKompas("categories")}:{" "}
          {template.categories.length > 0
            ? template.categories.map((c) => tTags(c)).join(", ")
            : tKompas("noCategories")}
          {template.categoriesFromSeason &&
            template.categoriesFromSeason !== template.season &&
            ` (${tKompas("categoriesFrom", { season: template.categoriesFromSeason })})`}
        </p>
        <p className="bg-muted rounded-md p-3 text-sm">{t("local")}</p>
      </header>
      <KompasForm
        clubId={template.club.clubId}
        trial
        editable
        version={0}
        categories={template.categories}
        areas={areas.map((a) => ({ number: a.number, name: a.name }))}
        questions={template.questions.map((q) => ({ ...q, tags: q.tags as QuestionTag[] }))}
      />
      <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
        {canOpenClub ? (
          <>
            <p>{t("member")}</p>
            <Button asChild size="sm" className="self-start">
              <Link href={`/klub/${encodeURIComponent(clubId)}/kompas`}>{t("memberButton")}</Link>
            </Button>
          </>
        ) : (
          !user && (
            <>
              <p>{t("signIn")}</p>
              <Button asChild size="sm" className="self-start">
                <Link href="/prihlasenie">{t("signInButton")}</Link>
              </Button>
            </>
          )
        )}
      </section>
    </div>
  );
}

export default function TrialKompasPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <TrialKompas {...props} />
      </Suspense>
    </main>
  );
}
