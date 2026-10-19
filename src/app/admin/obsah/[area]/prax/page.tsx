import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoPracticeStore } from "@/server/db/content.store";
import { isAdmin } from "@/server/services/club-access";
import { listAreas } from "@/server/services/content.service";
import { getPractice, listPracticeRevisions } from "@/server/services/practice.service";

import { revertPracticeAction } from "../../actions";
import { PracticeForm } from "./practice-form";

export const metadata: Metadata = { title: defaultMessages.admin.content.practice.title };

async function PracticeEditor({ params }: PageProps<"/admin/obsah/[area]/prax">) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("admin.content");
  if (!isAdmin(user)) {
    const tClub = await getTranslations("club");
    return <p className="text-sm">{tClub("forbidden")}</p>;
  }
  const number = Number((await params).area);
  const area = (await listAreas(mongoContentStore, user)).find((a) => a.number === number);
  const practice = area ? await getPractice(mongoPracticeStore, user, number) : null;
  if (!area || !practice) notFound();
  const history = await listPracticeRevisions(mongoContentStore, user, number);
  const format = await getFormatter();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold break-words">
          {area.number}. {area.name} · {t("practice.title")}
        </h1>
        <p className="text-muted-foreground text-xs">
          {t("question.version", { version: practice.version })}
        </p>
        <Link
          href={`/oblasti/${area.number}?tab=prax`}
          className="text-sm underline underline-offset-4"
        >
          {t("methodology.preview")}
        </Link>
      </header>
      <Card>
        <CardContent>
          <PracticeForm
            key={practice.version}
            area={number}
            json={JSON.stringify(practice.content, null, 2)}
            validAsOf={practice.validAsOf}
            reviewedAt={practice.reviewedAt}
            version={practice.version}
          />
        </CardContent>
      </Card>
      <details className="text-xs">
        <summary className="text-muted-foreground cursor-pointer">
          {t("question.history")} ({history.length})
        </summary>
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-2">{t("question.noHistory")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {history.map((rev) => (
              <li key={rev.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <span className="text-muted-foreground">
                  {t("question.version", { version: rev.version })} ·{" "}
                  {format.dateTime(new Date(rev.changedAt), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <form action={revertPracticeAction.bind(null, rev.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    {t("question.revert")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </details>
      <Link href="/admin/obsah" className="text-sm font-medium underline underline-offset-4">
        {t("back")}
      </Link>
    </div>
  );
}

export default function PracticeEditorPage(props: PageProps<"/admin/obsah/[area]/prax">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <PracticeEditor {...props} />
      </Suspense>
    </main>
  );
}
