"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { MentorRating } from "@/server/db/types";

import { rateVisitAction } from "./actions";

const VALUES: MentorRating[] = ["done", "partial", "not"];
const field =
  "border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm sm:w-40 sm:shrink-0";

/** The mentor rates the task before the visit and the agreed steps (MC-b, like the EYA mentoring). */
export function RatingsForm({
  clubId,
  visitId,
  version,
  prep,
  actions,
}: {
  clubId: string;
  visitId: string;
  version: number;
  /** null = the visit has no task before it */
  prep: { text: string; rating: MentorRating | null } | null;
  actions: { id: string; text: string; rating: MentorRating | null }[];
}) {
  const t = useTranslations("visits.ratings");
  const [prepRating, setPrepRating] = useState(prep?.rating ?? null);
  const [ratings, setRatings] = useState(Object.fromEntries(actions.map((a) => [a.id, a.rating])));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const select = (
    label: string,
    value: MentorRating | null,
    onChange: (v: MentorRating | null) => void,
  ) => (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as MentorRating | null)}
      className={field}
    >
      <option value="">{t("none")}</option>
      {VALUES.map((v) => (
        <option key={v} value={v}>
          {t(`values.${v}`)}
        </option>
      ))}
    </select>
  );

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await rateVisitAction(
        clubId,
        visitId,
        {
          ...(prep ? { prep: prepRating } : {}),
          actions: actions.map((a) => ({ id: a.id, rating: ratings[a.id] ?? null })),
        },
        version,
      );
      setMessage(res.status === "ok" ? t("saved") : t("error"));
    });

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground text-xs">{t("hint")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {prep && (
          <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground">{t("prep")}: </span>
              {prep.text}
            </span>
            {select(`${t("prep")}: ${prep.text}`, prepRating, setPrepRating)}
          </li>
        )}
        {actions.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1">{a.text}</span>
            {select(a.text, ratings[a.id] ?? null, (v) => setRatings((s) => ({ ...s, [a.id]: v })))}
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" className="self-start" disabled={pending} onClick={save}>
        {t("save")}
      </Button>
      <p role="status" aria-live="polite" className="text-xs">
        {message}
      </p>
    </section>
  );
}
