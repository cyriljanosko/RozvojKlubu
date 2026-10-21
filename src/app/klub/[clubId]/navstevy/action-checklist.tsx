"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { toggleVisitActionAction } from "./actions";

export interface ChecklistAction {
  id: string;
  text: string;
  /** owner · area · due, already formatted */
  meta: string;
  overdue: boolean;
  done: boolean;
  /** "splnené 23. 10." when done, already formatted */
  doneNote: string | null;
}

/** The club ticks agreed actions of a sent visit (MV-c); each change is saved at once. */
export function ActionChecklist({
  clubId,
  visitId,
  version,
  actions,
}: {
  clubId: string;
  visitId: string;
  version: number;
  actions: ChecklistAction[];
}) {
  const t = useTranslations("visits.club");
  const [items, setItems] = useState(actions);
  const [current, setCurrent] = useState(version);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = items.filter((a) => a.done).length;

  const toggle = (id: string, value: boolean) =>
    startTransition(async () => {
      setError(null);
      setItems((s) => s.map((a) => (a.id === id ? { ...a, done: value } : a)));
      const res = await toggleVisitActionAction(clubId, visitId, id, value, current);
      if (res.status === "ok") setCurrent(res.version);
      else {
        setItems((s) => s.map((a) => (a.id === id ? { ...a, done: !value } : a)));
        setError(res.code === "CONFLICT" ? t("conflict") : t("error"));
      }
    });

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("actions", { done, total: items.length })}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <li key={a.id}>
            <label
              className={`flex gap-3 rounded-lg border p-3 ${a.overdue && !a.done ? "border-destructive" : ""}`}
            >
              <input
                type="checkbox"
                className="accent-primary mt-0.5 size-5 shrink-0"
                checked={a.done}
                disabled={pending}
                onChange={(e) => toggle(a.id, e.target.checked)}
              />
              <span className="flex flex-col">
                <span className={a.done ? "line-through" : ""}>{a.text}</span>
                <span className="text-muted-foreground text-xs">
                  {a.meta}
                  {a.done && a.doneNote && ` · ${a.doneNote}`}
                  {!a.done && a.overdue && (
                    <span className="text-destructive"> · {t("overdue")}</span>
                  )}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="text-destructive text-sm">
        {error}
      </p>
    </section>
  );
}
