import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Alert, Button, Card, EmptyState, LinkButton, Select } from "@/components/sfz";
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

/** Public trial Kompas (ADR 0011): ?club= → categories from Sportnet, answers only in the browser.
 *  Without ?club= the trial runs without a club – every category applies (decision 28. 10. 2026). */
async function TrialKompas({ searchParams }: Props) {
  await connection();
  const t = await getTranslations("trialKompas");
  const tKompas = await getTranslations("kompas");
  const tTags = await getTranslations("questionTags");
  const { club } = await searchParams;
  const clubId = typeof club === "string" && club !== "" ? club : null;

  const clubs = await listPublicClubs(kompasDeps);
  let template;
  try {
    template = await getKompasTemplate(kompasDeps, clubId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return (
        <EmptyState
          title={t("notFound")}
          action={<LinkButton href="/kompas">{t("noClub")}</LinkButton>}
        />
      );
    }
    throw error;
  }
  const [areas, user] = await Promise.all([
    listAreas(mongoContentStore, null),
    getCurrentUser(await headers()),
  ]);
  const roles =
    user && clubId
      ? clubRolesFor(await kompasDeps.memberships.listByUser(user.id), clubId, currentSeason())
      : [];
  const canOpenClub =
    user !== null && clubId !== null && (isAdmin(user) || roles.some((r) => r !== "mentor"));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="large-title">{t("title")}</h1>
        <p className="body text-(--ink-muted)">{t("intro")}</p>
        {/* a GET form: works without JavaScript, the address keeps the chosen club */}
        <form action="/kompas" className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select
              name="club"
              label={t("clubLabel")}
              defaultValue={clubId ?? ""}
              options={[
                { value: "", label: t("noClub") },
                ...clubs.map((c) => ({ value: c.clubId, label: `${c.name} (${c.union})` })),
              ]}
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("show")}
          </Button>
        </form>
        <p className="footnote text-(--ink-muted)">
          {template.club ? (
            <>
              {tKompas("season", { season: template.season })} · {tKompas("categories")}:{" "}
              {template.categories.length > 0
                ? template.categories.map((c) => tTags(c)).join(", ")
                : tKompas("noCategories")}
              {template.categoriesFromSeason &&
                template.categoriesFromSeason !== template.season &&
                ` (${tKompas("categoriesFrom", { season: template.categoriesFromSeason })})`}
            </>
          ) : (
            t("noClubHint")
          )}
        </p>
        <Alert tone="info" title={t("localTitle")}>
          {t("local")}
        </Alert>
      </header>
      <KompasForm
        clubId={template.club?.clubId ?? null}
        trial
        editable
        version={0}
        categories={template.categories}
        areas={areas.map((a) => ({ number: a.number, name: a.name }))}
        questions={template.questions.map((q) => ({ ...q, tags: q.tags as QuestionTag[] }))}
      />
      {canOpenClub ? (
        <Card title={t("memberTitle")}>
          <div className="flex flex-col gap-3">
            <p className="callout">{t("member")}</p>
            <LinkButton href={`/klub/${encodeURIComponent(clubId)}/kompas`}>
              {t("memberButton")}
            </LinkButton>
          </div>
        </Card>
      ) : (
        !user && (
          <Card title={t("signInTitle")}>
            <div className="flex flex-col gap-3">
              <p className="callout">{t("signIn")}</p>
              <LinkButton href="/prihlasenie" variant="secondary">
                {t("signInButton")}
              </LinkButton>
            </div>
          </Card>
        )
      )}
      <p className="footnote text-(--ink-muted)">{t("pilot")}</p>
    </div>
  );
}

export default function TrialKompasPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <TrialKompas {...props} />
      </Suspense>
    </main>
  );
}
