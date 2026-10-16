import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore } from "@/server/db/content.store";
import { isAdmin } from "@/server/services/club-access";
import { listAreas, listQuestionRevisions, listQuestions } from "@/server/services/content.service";

import { revertQuestionAction } from "../actions";
import { QuestionForm } from "./question-form";

export const metadata: Metadata = { title: defaultMessages.admin.content.title };

async function AreaQuestions({ params }: PageProps<"/admin/obsah/[area]">) {
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
  const questions = await listQuestions(mongoContentStore, user, number);
  const histories = await Promise.all(
    questions.map((q) => listQuestionRevisions(mongoContentStore, user, q.questionId)),
  );
  const format = await getFormatter();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl break-words">
            {area.number}. {area.name}
          </CardTitle>
          <CardDescription>{area.description}</CardDescription>
        </CardHeader>
      </Card>
      {(["i", "s"] as const).map((column) => (
        <Card key={column}>
          <CardHeader>
            <CardTitle>{t(`columns.${column}`)}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-6">
              {questions
                .map((q, i) => ({ q, history: histories[i] }))
                .filter(({ q }) => q.column === column)
                .map(({ q, history }) => (
                  <li key={q.questionId} className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs">
                      {q.questionId} · {t("question.version", { version: q.version })}
                    </span>
                    <QuestionForm
                      key={q.version}
                      questionId={q.questionId}
                      text={q.text}
                      tags={q.tags}
                      version={q.version}
                    />
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer">
                        {t("question.history")} ({history.length})
                      </summary>
                      {history.length === 0 ? (
                        <p className="text-muted-foreground mt-2">{t("question.noHistory")}</p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-2">
                          {history.map((rev) => (
                            <li key={rev.id} className="flex flex-col gap-1 rounded-md border p-2">
                              <span className="text-muted-foreground">
                                {t("question.version", { version: rev.version })} ·{" "}
                                {format.dateTime(new Date(rev.changedAt), {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                              <span className="break-words line-through opacity-70">
                                {String(rev.before?.text ?? "")}
                              </span>
                              <span className="break-words">{String(rev.after.text ?? "")}</span>
                              <form action={revertQuestionAction.bind(null, rev.id)}>
                                <Button type="submit" variant="outline" size="sm">
                                  {t("question.revert")}
                                </Button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </li>
                ))}
            </ol>
          </CardContent>
        </Card>
      ))}
      <Link href="/admin/obsah" className="text-sm font-medium underline underline-offset-4">
        {t("back")}
      </Link>
    </div>
  );
}

export default function AreaQuestionsPage(props: PageProps<"/admin/obsah/[area]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <AreaQuestions {...props} />
      </Suspense>
    </main>
  );
}
