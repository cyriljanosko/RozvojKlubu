"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Select } from "@/components/sfz";
import type { PlanGoalStatus } from "@/server/db/types";

import { setGoalStatusAction } from "./actions";

const STATUSES: PlanGoalStatus[] = ["todo", "doing", "done"];

/** Status of one goal – management, the mentor, admin_sfz or the goal's owner. */
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
      <Select
        label={t("statusLabel")}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const s = e.target.value as PlanGoalStatus;
          startTransition(async () => {
            const before = current;
            setCurrent(s);
            setError(null);
            const res = await setGoalStatusAction(clubId, goalId, s, version);
            if (res.status === "error") {
              setCurrent(before);
              setError(res.code === "CONFLICT" ? t("errors.CONFLICT") : t("errors.INTERNAL"));
            }
          });
        }}
        options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
      />
      {error && (
        <p role="status" className="footnote text-(--danger)">
          {error}
        </p>
      )}
    </div>
  );
}
