import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoSectionStore } from "@/server/db/content.store";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { listMethodology, listSectionRevisions } from "@/server/services/methodology.service";

import { revertSectionAction } from "../../actions";
import { SectionForm } from "./section-form";

export const metadata: Metadata = { title: defaultMessages.admin.content.methodology.title };

async function MethodologyEditor({ params }: PageProps<"/admin/obsah/[area]/metodika">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("admin.content");
  if (!isAdmin(user)) {
    const tClub = await getTranslations("club");
    return <p className="text-sm">{tClub("forbidden")}</p>;
  }
  const number = Number((await params).area);
  const area = (await listAreas(mongoContentStore, user)).find((a) => a.number === number);
  if (!area) notFound();
  const sections = await listMethodology(mongoSectionStore, user, number);
  const histories = await Promise.all(
    sections.map((s) => listSectionRevisions(mongoContentStore, user, number, s.key)),
  );
  const format = await getFormatter();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold break-words">
          {area.number}. {area.name} · {t("methodology.title")}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/oblasti/${area.number}`} className="underline underline-offset-4">
            {t("methodology.preview")}
          </Link>
          <Link href={`/admin/obsah/${area.number}`} className="underline underline-offset-4">
            {t("methodology.questions")}
          </Link>
        </div>
      </header>
      {sections.map((s, i) => (
        <Card key={s.key}>
          <CardHeader>
            <CardTitle className="break-words">{s.title}</CardTitle>
            <p className="text-muted-foreground text-xs">
              #{s.key} · {t("question.version", { version: s.version })}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SectionForm
              key={s.version}
              area={number}
              sectionKey={s.key}
              title={s.title}
              body={s.body}
              validAsOf={s.validAsOf}
              reviewedAt={s.reviewedAt}
              version={s.version}
            />
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer">
                {t("question.history")} ({histories[i].length})
              </summary>
              {histories[i].length === 0 ? (
                <p className="text-muted-foreground mt-2">{t("question.noHistory")}</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {histories[i].map((rev) => (
                    <li
                      key={rev.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border p-2"
                    >
                      <span className="text-muted-foreground">
                        {t("question.version", { version: rev.version })} ·{" "}
                        {format.dateTime(new Date(rev.changedAt), {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <form action={revertSectionAction.bind(null, rev.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          {t("question.revert")}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </CardContent>
        </Card>
      ))}
      <Link href="/admin/obsah" className="text-sm font-medium underline underline-offset-4">
        {t("back")}
      </Link>
    </div>
  );
}

export default function MethodologyEditorPage(props: PageProps<"/admin/obsah/[area]/metodika">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <MethodologyEditor {...props} />
      </Suspense>
    </main>
  );
}
