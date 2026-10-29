"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button, Drawer, Input, Select, Textarea } from "@/components/sfz";
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
export const MAX_GOALS = 10;

/** A new goal in `area`, empty otherwise. */
export const blankGoal = (area: number): GoalValue => ({
  area,
  title: "",
  publicText: "",
  indicator: "",
  owner: "",
  ownerId: null,
  dueDate: null,
  status: "todo",
});

const toInput = (g: GoalValue) => ({
  id: g.id,
  area: g.area,
  title: g.title,
  publicText: g.publicText,
  indicator: g.indicator,
  owner: g.owner,
  ownerId: g.ownerId,
  dueDate: g.dueDate || null,
  status: g.status,
});

/**
 * One goal of the season's plan in a side panel (CP-b, design "Klub – plán rozvoja"):
 * management and the mentor add, edit or remove a goal; the whole plan is saved, as before.
 */
export function GoalDrawer({
  clubId,
  version,
  goals,
  editing,
  onClose,
  members,
  areas,
}: {
  clubId: string;
  version: number;
  /** all goals of the plan as saved */
  goals: GoalValue[];
  /** index in `goals`, or a new goal; null = closed */
  editing: number | GoalValue | null;
  onClose: () => void;
  members: { userId: string; name: string }[];
  areas: { number: number; name: string }[];
}) {
  const t = useTranslations("plan");
  const router = useRouter();
  const isNew = typeof editing === "object" && editing !== null;
  const start = editing === null ? null : isNew ? editing : goals[editing];
  const [goal, setGoal] = useState<GoalValue | null>(start);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!goal) return null;
  const update = (patch: Partial<GoalValue>) => setGoal((g) => (g ? { ...g, ...patch } : g));

  const persist = (next: GoalValue[]) =>
    startTransition(async () => {
      setMessage(null);
      const res = await savePlanAction(clubId, {
        goals: next.map(toInput),
        expectedVersion: version,
      });
      if (res.status === "error") return setMessage(t(`errors.${res.code}`));
      onClose();
      router.refresh();
    });

  const save = () => {
    if (!goal.title.trim() || !goal.publicText.trim() || !goal.owner.trim()) {
      return setMessage(t("errors.requiredOne"));
    }
    persist(isNew ? [...goals, goal] : goals.map((g, i) => (i === editing ? goal : g)));
  };

  const remove = () => persist(goals.filter((_, i) => i !== editing));

  return (
    <Drawer
      open
      onClose={onClose}
      side="right"
      width={420}
      title={isNew ? t("newGoal") : t("editGoal")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-4"
      >
        <Select
          label={t("area")}
          value={String(goal.area)}
          onChange={(e) => update({ area: Number(e.target.value) })}
          options={areas.map((a) => ({
            value: String(a.number),
            label: `${a.number} · ${a.name}`,
          }))}
        />
        <Input
          label={t("title")}
          value={goal.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={t("titlePlaceholder")}
          maxLength={300}
          required
        />
        <Textarea
          label={t("publicText")}
          hint={t("publicHint")}
          value={goal.publicText}
          onChange={(e) => update({ publicText: e.target.value })}
          placeholder={t("publicPlaceholder")}
          rows={3}
          maxLength={300}
          required
        />
        <Select
          label={t("owner")}
          value={goal.ownerId ?? (goal.ownerOther || goal.owner ? OTHER : "")}
          onChange={(e) => {
            const m = members.find((x) => x.userId === e.target.value);
            if (m) update({ ownerId: m.userId, owner: m.name, ownerOther: false });
            else if (e.target.value === OTHER)
              update({ ownerId: null, owner: "", ownerOther: true });
            else update({ ownerId: null, owner: "", ownerOther: false });
          }}
          options={[
            { value: "", label: t("ownerPick") },
            ...members.map((m) => ({ value: m.userId, label: m.name })),
            { value: OTHER, label: t("ownerOther") },
          ]}
        />
        {goal.ownerId === null && (goal.ownerOther || goal.owner) && (
          <Input
            label={t("ownerName")}
            value={goal.owner}
            onChange={(e) => update({ owner: e.target.value })}
            maxLength={120}
          />
        )}
        <Input
          label={t("due")}
          type="date"
          value={goal.dueDate ?? ""}
          onChange={(e) => update({ dueDate: e.target.value || null })}
        />
        <Input
          label={`${t("indicator")} · ${t("optional")}`}
          value={goal.indicator}
          onChange={(e) => update({ indicator: e.target.value })}
          placeholder={t("indicatorPlaceholder")}
          maxLength={500}
        />
        <Select
          label={t("statusLabel")}
          value={goal.status}
          onChange={(e) => update({ status: e.target.value as PlanGoalStatus })}
          options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        />
        <Button type="submit" block loading={pending}>
          {t("saveGoal")}
        </Button>
        {!isNew && (
          <Button variant="danger" block disabled={pending} onClick={remove}>
            {t("remove")}
          </Button>
        )}
        <p role="status" aria-live="polite" className="footnote text-(--danger)">
          {message}
        </p>
      </form>
    </Drawer>
  );
}
