"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { PlanGoalStatus } from "@/server/db/types";

import { setGoalStatusAction } from "./actions";

const STATUSES: PlanGoalStatus[] = ["todo", "doing", "done"];

/** Status of one goal on one tap – management, the mentor, admin_sfz or the goal's owner. */
export function GoalStatus({
  clubId,
  goalId,
  status,
  version,
}: {
  clubId: string;
  goalId: string;
  status: PlanGoalStatus;
  version: number;
}) {
  const t = useTranslations("plan");
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <div
        className="grid grid-cols-3 overflow-hidden rounded-md border text-xs"
        role="group"
        aria-label={t("statusLabel")}
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={current === s}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const before = current;
                setCurrent(s);
                setError(null);
                const res = await setGoalStatusAction(clubId, goalId, s, version);
                if (res.status === "error") {
                  setCurrent(before);
                  setError(res.code === "CONFLICT" ? t("errors.CONFLICT") : t("errors.INTERNAL"));
                }
              })
            }
            className="aria-pressed:bg-primary aria-pressed:text-primary-foreground px-2 py-1.5"
          >
            {t(`status.${s}`)}
          </button>
        ))}
      </div>
      {error && (
        <p role="status" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
