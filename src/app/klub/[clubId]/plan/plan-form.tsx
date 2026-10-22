"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlanGoalStatus } from "@/server/db/types";

import { savePlanAction } from "./actions";

export interface GoalValue {
  id?: string;
  area: number;
  title: string;
  publicText: string;
  indicator: string;
  owner: string;
  ownerId: string | null;
  /** client only: "someone else" was chosen and the name is typed */
  ownerOther?: boolean;
  dueDate: string | null;
  status: PlanGoalStatus;
}

const STATUSES: PlanGoalStatus[] = ["todo", "doing", "done"];
const OTHER = "__other";
const MAX_GOALS = 10;
const field =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/** Management and the mentor compose the season's plan (CP-b). */
export function PlanForm({
  clubId,
  version,
  initial,
  members,
  areas,
  planHref,
}: {
  clubId: string;
  version: number;
  initial: GoalValue[];
  members: { userId: string; name: string }[];
  areas: { number: number; name: string }[];
  planHref: string;
}) {
  const t = useTranslations("plan");
  const router = useRouter();
  const [goals, setGoals] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const update = (i: number, patch: Partial<GoalValue>) =>
    setGoals((s) => s.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const save = () =>
    startTransition(async () => {
      if (goals.some((g) => !g.title.trim() || !g.publicText.trim() || !g.owner.trim())) {
        return setMessage(t("errors.required"));
      }
      setMessage(null);
      const res = await savePlanAction(clubId, {
        goals: goals.map((g) => ({
          id: g.id,
          area: g.area,
          title: g.title,
          publicText: g.publicText,
          indicator: g.indicator,
          owner: g.owner,
          ownerId: g.ownerId,
          dueDate: g.dueDate || null,
          status: g.status,
        })),
        expectedVersion: version,
      });
      if (res.status === "error") return setMessage(t(`errors.${res.code}`));
      router.push(planHref);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      {goals.map((g, i) => (
        <fieldset key={g.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">{t("goalN", { n: i + 1 })}</legend>
          <div className="flex gap-2">
            <select
              value={g.area}
              aria-label={t("area")}
              onChange={(e) => update(i, { area: Number(e.target.value) })}
              className={field}
            >
              {areas.map((a) => (
                <option key={a.number} value={a.number}>
                  {a.number} · {a.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("remove")}
              onClick={() => setGoals((s) => s.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("title")}</span>
            <input
              value={g.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder={t("titlePlaceholder")}
              maxLength={300}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("publicText")}</span>
            <textarea
              value={g.publicText}
              onChange={(e) => update(i, { publicText: e.target.value })}
              placeholder={t("publicPlaceholder")}
              rows={2}
              maxLength={300}
              className={field}
            />
            <span className="rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              {t("publicHint")}
            </span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("owner")}</span>
              <select
                value={g.ownerId ?? (g.ownerOther || g.owner ? OTHER : "")}
                onChange={(e) => {
                  const m = members.find((x) => x.userId === e.target.value);
                  if (m) update(i, { ownerId: m.userId, owner: m.name, ownerOther: false });
                  else if (e.target.value === OTHER)
                    update(i, { ownerId: null, owner: "", ownerOther: true });
                  else update(i, { ownerId: null, owner: "", ownerOther: false });
                }}
                className={field}
              >
                <option value="">{t("ownerPick")}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
                <option value={OTHER}>{t("ownerOther")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("due")}</span>
              <input
                type="date"
                value={g.dueDate ?? ""}
                onChange={(e) => update(i, { dueDate: e.target.value || null })}
                className={field}
              />
            </label>
          </div>
          {g.ownerId === null && (g.ownerOther || g.owner) && (
            <input
              value={g.owner}
              onChange={(e) => update(i, { owner: e.target.value })}
              placeholder={t("ownerName")}
              aria-label={t("ownerName")}
              maxLength={120}
              className={field}
            />
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {t("indicator")}{" "}
              <span className="text-muted-foreground font-normal">· {t("optional")}</span>
            </span>
            <input
              value={g.indicator}
              onChange={(e) => update(i, { indicator: e.target.value })}
              placeholder={t("indicatorPlaceholder")}
              maxLength={500}
              className={field}
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("statusLabel")}</span>
            <div className="grid grid-cols-3 overflow-hidden rounded-md border text-xs">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={g.status === s}
                  onClick={() => update(i, { status: s })}
                  className="aria-pressed:bg-primary aria-pressed:text-primary-foreground px-2 py-1.5"
                >
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
          </div>
        </fieldset>
      ))}
      {goals.length < MAX_GOALS && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() =>
            setGoals((s) => [
              ...s,
              {
                area: areas.find((a) => !s.some((g) => g.area === a.number))?.number ?? 1,
                title: "",
                publicText: "",
                indicator: "",
                owner: "",
                ownerId: null,
                dueDate: null,
                status: "todo",
              },
            ])
          }
        >
          <Plus aria-hidden /> {t("addGoal")}
        </Button>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {version > 0 && (
          <Button type="button" variant="ghost" onClick={() => router.push(planHref)}>
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
