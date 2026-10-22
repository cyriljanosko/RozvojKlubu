"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { MentoringPartKey } from "@/server/services/club-mentoring.service";

import { saveMentoringPartAction } from "./actions";

const field =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
const MAX_AREAS = 3;

export interface PartField {
  key: string;
  /** message key under mentoring.fields (label) and mentoring.placeholders */
  label: string;
  hint?: string;
}

/** One part of the mentoring cycle (MC-c): a short form, folded behind "Vyplniť / Upraviť" once saved. */
export function PartForm({
  clubId,
  part,
  fields,
  initial,
  areas,
  version,
  filled,
  startOpen = false,
}: {
  clubId: string;
  part: MentoringPartKey;
  fields: PartField[];
  initial: Record<string, string>;
  /** the focus part also picks 1–3 priority areas */
  areas?: { options: { number: number; name: string }[]; chosen: number[] };
  version: number;
  /** the part was already saved – the form opens on "Upraviť" */
  filled: boolean;
  /** open at once: the part waits for this viewer (intro for management, focus for the mentor) */
  startOpen?: boolean;
}) {
  const t = useTranslations("mentoring");
  const [open, setOpen] = useState(startOpen && !filled);
  const [values, setValues] = useState(initial);
  const [chosen, setChosen] = useState(areas?.chosen ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start print:hidden"
        onClick={() => setOpen(true)}
      >
        {filled ? t("edit") : t("fill")}
      </Button>
    );
  }

  const save = () =>
    startTransition(async () => {
      if (areas && (chosen.length < 1 || chosen.length > MAX_AREAS)) {
        return setMessage(t("errors.areas"));
      }
      setMessage(null);
      const res = await saveMentoringPartAction(
        clubId,
        part,
        { ...values, ...(areas ? { areas: chosen } : {}) },
        version,
      );
      if (res.status === "error") {
        const code = ["CONFLICT", "FORBIDDEN", "BAD_REQUEST"].includes(res.code)
          ? res.code
          : "INTERNAL";
        return setMessage(t(`errors.${code}`));
      }
      setMessage(t("saved"));
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3 print:hidden"
    >
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(`fields.${f.label}`)}</span>
          {f.hint && <span className="text-muted-foreground text-xs">{t(`fields.${f.hint}`)}</span>}
          <textarea
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
            placeholder={t(`placeholders.${f.label}`)}
            rows={3}
            maxLength={3000}
            className={field}
          />
        </label>
      ))}
      {areas && (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("fields.areas")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {areas.options.map((a) => {
              const on = chosen.includes(a.number);
              return (
                <button
                  key={a.number}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && chosen.length >= MAX_AREAS}
                  onClick={() =>
                    setChosen((s) => (on ? s.filter((x) => x !== a.number) : [...s, a.number]))
                  }
                  className="aria-pressed:bg-primary aria-pressed:text-primary-foreground rounded-full border px-3 py-1 text-xs disabled:opacity-40"
                >
                  {a.number} · {a.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {(filled || !startOpen) && (
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  );
}
