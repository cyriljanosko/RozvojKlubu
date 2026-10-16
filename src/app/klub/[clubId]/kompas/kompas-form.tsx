"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Save, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { QuestionTag } from "@/server/db/types";
import {
  bandOf,
  scoreKompas,
  type ClubCategory,
  type ScoringQuestion,
} from "@/server/services/kompas-scoring";

import { saveKompasAction, submitKompasAction } from "./actions";

export interface KompasFormProps {
  clubId: string;
  editable: boolean;
  version: number;
  categories: ClubCategory[];
  areas: { number: number; name: string }[];
  questions: (ScoringQuestion & { valid: boolean; checked: boolean })[];
}

const BAND_COLOR: Record<string, string> = {
  start: "bg-red-600",
  rising: "bg-orange-500",
  average: "bg-zinc-500",
  good: "bg-blue-600",
  model: "bg-amber-600",
};

export function KompasForm(props: KompasFormProps) {
  const t = useTranslations("kompas");
  const tTags = useTranslations("questionTags");
  const [checked, setChecked] = useState(
    () => new Set(props.questions.filter((q) => q.checked).map((q) => q.questionId)),
  );
  const [saved, setSaved] = useState(() => new Set(checked));
  const [version, setVersion] = useState(props.version);
  const [message, setMessage] = useState<"saved" | "conflict" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState<
    "done" | "saveFirst" | "empty" | "error" | null
  >(null);
  const [pending, startTransition] = useTransition();

  const result = useMemo(
    () => scoreKompas(props.questions, props.categories, checked),
    [props.questions, props.categories, checked],
  );
  const dirty = checked.size !== saved.size || [...checked].some((id) => !saved.has(id));

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const res = await saveKompasAction(props.clubId, [...checked], version);
      if (res.status === "ok") {
        setVersion(res.version);
        setSaved(new Set(checked));
        setMessage("saved");
      } else {
        setMessage(res.code === "CONFLICT" ? "conflict" : "error");
      }
    });

  const submit = () =>
    startTransition(async () => {
      const res = await submitKompasAction(props.clubId, version);
      if (res.status === "ok") setSubmitMessage("done");
      else
        setSubmitMessage(
          res.code === "CONFLICT" ? "saveFirst" : res.code === "BAD_REQUEST" ? "empty" : "error",
        );
    });

  const missingTags = (tags: readonly QuestionTag[]) =>
    tags
      .filter((tag) => tag !== "rast")
      .map((tag) => tTags(tag))
      .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-primary text-primary-foreground sticky top-0 z-10 flex flex-col gap-1 rounded-xl p-4">
        <p className="text-2xl font-semibold tabular-nums">{t("total", { total: result.total })}</p>
        <p className="text-sm opacity-90">
          {t("filled", { filled: result.filledAreas })}
          {result.average !== null &&
            ` · ${t("average", {
              average: result.average.toLocaleString("sk", { maximumFractionDigits: 1 }),
              band: t(`bands.${bandOf(result.average).key}`),
            })}`}
        </p>
        {props.editable && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={save}
              disabled={pending || !dirty}
            >
              <Save aria-hidden />
              {t("save")}
            </Button>
            <span role="status" className="text-xs">
              {dirty && message !== "conflict" && t("unsaved")}
              {!dirty && message === "saved" && t("saved", { version })}
              {message === "conflict" && t("conflict")}
              {message === "error" && t("error")}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={submit}
              disabled={pending || dirty || version === 0 || result.filledAreas === 0}
            >
              <Send aria-hidden />
              {t("submit.button")}
            </Button>
            <span role="status" className="text-xs">
              {!dirty && submitMessage && t(`submit.${submitMessage}`)}
            </span>
          </div>
        )}
      </section>

      <ol className="flex flex-col gap-2">
        {props.areas.map((area) => {
          const r = result.areas.find((a) => a.area === area.number);
          const qs = props.questions.filter((q) => q.area === area.number);
          return (
            <li key={area.number}>
              <details className="rounded-xl border">
                <summary className="flex cursor-pointer items-center gap-3 p-3">
                  <span
                    className={`${r?.band ? `${BAND_COLOR[r.band]} text-white` : "bg-muted text-muted-foreground"} flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold`}
                  >
                    {area.number}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium break-words">{area.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {r?.status === "scored" && r.points !== null
                        ? `${t("areaScore", { points: r.points })} · ${t(`bands.${r.band!}`)}`
                        : r?.status === "few"
                          ? t("areaFew")
                          : t("areaEmpty")}
                    </span>
                  </span>
                </summary>
                <div className="grid gap-4 border-t p-3 lg:grid-cols-2">
                  {(["i", "s"] as const).map((column) => (
                    <fieldset key={column} className="flex flex-col gap-1">
                      <legend className="mb-1 flex w-full justify-between text-sm font-semibold">
                        <span>{t(`columns.${column}`)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {r?.columns[column].points ?? "–"} / 10
                        </span>
                      </legend>
                      {qs
                        .filter((q) => q.column === column)
                        .map((q) => (
                          <label
                            key={q.questionId}
                            className={`flex gap-2 rounded-md p-1.5 text-sm ${q.valid ? "hover:bg-muted/50" : "opacity-50"}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0"
                              checked={checked.has(q.questionId)}
                              onChange={() => toggle(q.questionId)}
                              disabled={!props.editable || !q.valid}
                            />
                            <span>
                              {q.text}
                              {!q.valid && (
                                <span className="text-muted-foreground block text-xs">
                                  {t("notApplicable", { tags: missingTags(q.tags) })}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                    </fieldset>
                  ))}
                  <Link
                    href={`/oblasti/${area.number}`}
                    className="text-sm underline underline-offset-4 lg:col-span-2"
                  >
                    {t("next.methodology")}
                  </Link>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">{t("next.title")}</h2>
        {result.next.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("next.empty")}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{t("next.intro")}</p>
            <ol className="grid gap-3 lg:grid-cols-3">
              {result.next.map((n, i) => {
                const name = props.areas.find((a) => a.number === n.area)?.name;
                return (
                  <li key={n.area} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                    <span className="text-muted-foreground text-xs">{t.raw("next.order")[i]}</span>
                    <span className="font-semibold">
                      {n.area}. {name} · {t("areaScore", { points: n.points })}
                    </span>
                    <ul className="list-disc space-y-1 pl-5">
                      {n.tasks.map((task) => (
                        <li key={task.questionId}>{task.text}</li>
                      ))}
                    </ul>
                    <span className="mt-auto flex flex-wrap gap-x-3 text-xs">
                      <Link href={`/oblasti/${n.area}`} className="underline underline-offset-4">
                        {t("next.methodology")}
                      </Link>
                      {[3, 4].includes(n.area) && (
                        <Link
                          href={`/oblasti/${n.area}?tab=prax`}
                          className="underline underline-offset-4"
                        >
                          {t("next.practice")}
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
