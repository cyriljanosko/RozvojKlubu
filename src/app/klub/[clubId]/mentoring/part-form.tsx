"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button, Chip, Textarea } from "@/components/sfz";
import type { MentoringPartKey } from "@/server/services/club-mentoring.service";

import { saveMentoringPartAction } from "./actions";

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
        variant="secondary"
        size="sm"
        icon={filled ? "edit" : undefined}
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
        <Textarea
          key={f.key}
          label={t(`fields.${f.label}`)}
          hint={f.hint ? t(`fields.${f.hint}`) : undefined}
          value={values[f.key] ?? ""}
          onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
          placeholder={t(`placeholders.${f.label}`)}
          rows={3}
          maxLength={3000}
        />
      ))}
      {areas && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-1">{t("fields.areas")}</legend>
          <div className="flex flex-wrap gap-2">
            {areas.options.map((a) => {
              const on = chosen.includes(a.number);
              return (
                <Chip
                  key={a.number}
                  selected={on}
                  disabled={!on && chosen.length >= MAX_AREAS}
                  onClick={() =>
                    setChosen((s) => (on ? s.filter((x) => x !== a.number) : [...s, a.number]))
                  }
                >
                  {a.number} · {a.name}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
        {(filled || !startOpen) && (
          <Button variant="tertiary" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="footnote">
        {message}
      </p>
    </form>
  );
}
