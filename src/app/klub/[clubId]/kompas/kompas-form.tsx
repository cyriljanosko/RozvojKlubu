"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionItem,
  Alert,
  Button,
  Card,
  Checkbox,
  KompasBandBadge,
  LinkButton,
} from "@/components/sfz";
import type { QuestionTag } from "@/server/db/types";
import {
  bandOf,
  scoreKompas,
  type ClubCategory,
  type ScoringQuestion,
} from "@/server/services/kompas-scoring";

import { saveKompasAction, submitKompasAction } from "./actions";

export interface KompasFormProps {
  /** null = public trial without a club (every category applies) */
  clubId: string | null;
  /** public trial (ADR 0011): no saving, answers kept only in this browser */
  trial?: boolean;
  editable: boolean;
  version: number;
  categories: ClubCategory[];
  areas: { number: number; name: string }[];
  questions: (ScoringQuestion & { valid: boolean; checked: boolean })[];
}

/** Browser key of the trial answers; a trial without a club uses "none". */
const trialKey = (clubId: string | null) => `kompas-trial:${clubId ?? "none"}`;

function readTrial(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : null;
  } catch {
    return null; // storage may be unavailable (private mode)
  }
}

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
  // club Kompas: answers from a trial in this browser, offered once after sign-in (decision 26. 10.)
  const [offer, setOffer] = useState<{ key: string; ids: string[] } | null>(null);
  const [transferred, setTransferred] = useState<string | null>(null);

  const storageKey = trialKey(props.clubId);
  const canTransfer = !props.trial && props.editable;
  useEffect(() => {
    if (props.trial) {
      const ids = readTrial(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore answers saved in this browser
      if (ids) setChecked(new Set(ids));
      return;
    }
    if (!canTransfer) return;
    // the club's own trial first, then a trial without a club
    for (const key of [storageKey, trialKey(null)]) {
      const ids = readTrial(key);
      if (ids) {
        setOffer({ key, ids });
        return;
      }
    }
  }, [props.trial, canTransfer, storageKey]);

  const valid = useMemo(
    () => new Set(props.questions.filter((q) => q.valid).map((q) => q.questionId)),
    [props.questions],
  );
  const result = useMemo(
    () => scoreKompas(props.questions, props.categories, checked),
    [props.questions, props.categories, checked],
  );
  const dirty = checked.size !== saved.size || [...checked].some((id) => !saved.has(id));

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    // trial answers are stored on change only – an effect would overwrite them before restoring
    if (props.trial) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // storage may be unavailable (private mode); the trial still works
      }
    }
  };

  const takeOver = () => {
    if (!offer) return;
    // only questions that apply to this club; the club then saves as usual
    setChecked(new Set(offer.ids.filter((id) => valid.has(id))));
    setTransferred(offer.key);
    setOffer(null);
  };

  const dismissOffer = () => {
    if (!offer) return;
    try {
      window.localStorage.removeItem(offer.key);
    } catch {
      // nothing to clean up
    }
    setOffer(null);
  };

  const save = () =>
    startTransition(async () => {
      if (!props.clubId) return;
      const res = await saveKompasAction(props.clubId, [...checked], version);
      if (res.status === "ok") {
        setVersion(res.version);
        setSaved(new Set(checked));
        setMessage("saved");
        if (transferred) {
          // the trial answers now live in the club's Kompas
          try {
            window.localStorage.removeItem(transferred);
          } catch {
            // nothing to clean up
          }
          setTransferred(null);
        }
      } else {
        setMessage(res.code === "CONFLICT" ? "conflict" : "error");
      }
    });

  const submit = () =>
    startTransition(async () => {
      if (!props.clubId) return;
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

  const summary = (
    <>
      {t("filled", { filled: result.filledAreas })}
      {result.average !== null &&
        ` · ${t("average", {
          average: result.average.toLocaleString("sk", { maximumFractionDigits: 1 }),
          band: t(`bands.${bandOf(result.average).key}`),
        })}`}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {offer && (
        <Alert
          tone="info"
          title={t("transfer.title", { count: offer.ids.filter((id) => valid.has(id)).length })}
          action={
            <span className="flex flex-wrap gap-2">
              <Button size="sm" onClick={takeOver}>
                {t("transfer.take")}
              </Button>
              <Button size="sm" variant="tertiary" onClick={dismissOffer}>
                {t("transfer.dismiss")}
              </Button>
            </span>
          }
        >
          {checked.size > 0 ? t("transfer.replace") : t("transfer.body")}
        </Alert>
      )}
      {transferred && dirty && <Alert tone="info">{t("transfer.saveNow")}</Alert>}

      <section className="flex flex-col gap-2" aria-labelledby="kompas-areas">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="kompas-areas" className="title-3">
            {t("areas")}
          </h2>
          <span className="footnote text-(--ink-muted)">
            {t("filledShort", { filled: result.filledAreas })}
          </span>
        </div>
        <Accordion>
          {props.areas.map((area) => {
            const r = result.areas.find((a) => a.area === area.number);
            const qs = props.questions.filter((q) => q.area === area.number);
            const applies = qs.filter((q) => q.valid);
            const answered = applies.filter((q) => checked.has(q.questionId)).length;
            return (
              <AccordionItem
                key={area.number}
                id={`oblast-${area.number}`}
                title={
                  <span className="flex items-center gap-3">
                    <span className="w-6 shrink-0 font-bold text-(--ink-muted)">{area.number}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="break-words">{area.name}</span>
                      <span className="footnote font-normal text-(--ink-muted)">
                        {r?.status === "scored" && r.points !== null
                          ? `${t("areaScore", { points: r.points })} · ${t("answered", { answered, total: applies.length })}`
                          : r?.status === "few"
                            ? t("areaFew")
                            : t("areaEmpty")}
                      </span>
                    </span>
                    {r?.band && (
                      <KompasBandBadge band={r.band}>{t(`bands.${r.band}`)}</KompasBandBadge>
                    )}
                  </span>
                }
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {(["i", "s"] as const).map((column) => (
                    <fieldset key={column} className="flex min-w-0 flex-col">
                      <legend className="label mb-1 flex w-full justify-between text-(--ink-muted) uppercase">
                        <span>{t(`columns.${column}`)}</span>
                        <span className="tabular-nums">
                          {r?.columns[column].points ?? "–"} / 10
                        </span>
                      </legend>
                      {qs
                        .filter((q) => q.column === column)
                        .map((q) => (
                          <Checkbox
                            key={q.questionId}
                            label={q.text}
                            description={
                              q.valid
                                ? undefined
                                : t("notApplicable", { tags: missingTags(q.tags) })
                            }
                            checked={checked.has(q.questionId)}
                            onChange={() => toggle(q.questionId)}
                            disabled={!props.editable || !q.valid}
                          />
                        ))}
                    </fieldset>
                  ))}
                  <Link href={`/oblasti/${area.number}`} className="subheadline lg:col-span-2">
                    {t("howTo", { name: area.name })}
                  </Link>
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>

      <Card id="vysledok" title={t("next.title")} className="scroll-mt-6">
        {result.next.length === 0 ? (
          <p className="callout text-(--ink-muted)">{t("next.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="callout text-(--ink-muted)">{t("next.intro")}</p>
            <ol className="grid gap-3 lg:grid-cols-3">
              {result.next.map((n, i) => {
                const name = props.areas.find((a) => a.number === n.area)?.name;
                return (
                  <li
                    key={n.area}
                    className="flex flex-col gap-2 rounded-(--radius-sm) bg-(--surface) p-3"
                  >
                    <span className="label text-(--brand-blue-ink) uppercase">
                      {t.raw("next.order")[i]}
                    </span>
                    <span className="headline">
                      {n.area}. {name} · {t("areaScore", { points: n.points })}
                    </span>
                    <ul className="callout list-disc space-y-1 pl-5">
                      {n.tasks.map((task) => (
                        <li key={task.questionId}>{task.text}</li>
                      ))}
                    </ul>
                    <span className="subheadline mt-auto flex flex-wrap gap-x-4">
                      <Link href={`/oblasti/${n.area}`}>{t("next.methodology")}</Link>
                      {[3, 4].includes(n.area) && (
                        <Link href={`/oblasti/${n.area}?tab=prax`}>{t("next.practice")}</Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>

      {/* running score above the tab bar (mobile) or the bottom edge (desktop), as in the design */}
      <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom,0px))] z-10 flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-(--hairline) bg-(--surface) px-4 py-3 md:bottom-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="headline tabular-nums">{t("total", { total: result.total })}</span>
          <span className="footnote text-(--ink-muted)">{summary}</span>
        </div>
        {props.editable && !props.trial ? (
          <>
            <Button
              variant="secondary"
              icon="check"
              onClick={save}
              disabled={pending || !dirty}
              loading={pending}
            >
              {t("save")}
            </Button>
            <Button
              onClick={submit}
              disabled={pending || dirty || version === 0 || result.filledAreas === 0}
            >
              {t("submit.button")}
            </Button>
            <p className="footnote w-full" role="status">
              {dirty && message !== "conflict" && t("unsaved")}
              {!dirty && message === "saved" && t("saved", { version })}
              {message === "conflict" && <span className="text-(--danger)">{t("conflict")}</span>}
              {message === "error" && <span className="text-(--danger)">{t("error")}</span>}
              {!dirty && submitMessage && ` ${t(`submit.${submitMessage}`)}`}
            </p>
          </>
        ) : (
          <LinkButton href="#vysledok">{t("result")}</LinkButton>
        )}
      </div>
    </div>
  );
}
