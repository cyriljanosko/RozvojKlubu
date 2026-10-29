"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { prepDoneAction } from "./actions";

/** The club ticks the task before the visit as prepared (MC-b); saved at once. */
export function PrepCheck({
  clubId,
  visitId,
  version,
  done: initial,
}: {
  clubId: string;
  visitId: string;
  version: number;
  done: boolean;
}) {
  const t = useTranslations("visits.prep");
  const [done, setDone] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (value: boolean) =>
    startTransition(async () => {
      setError(false);
      setDone(value);
      const res = await prepDoneAction(clubId, visitId, value, version);
      if (res.status === "error") {
        setDone(!value);
        setError(true);
      }
    });

  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-(--brand-blue)"
          checked={done}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />
        {t("tick")}
      </label>
      {error && (
        <p role="status" className="text-xs text-(--danger)">
          {t("error")}
        </p>
      )}
    </>
  );
}
