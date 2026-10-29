"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge, Button, EmptyState } from "@/components/sfz";

import { GoalStatus } from "./goal-status";
import { GoalDrawer, MAX_GOALS, blankGoal, type GoalValue } from "./plan-form";

const TONE = { todo: "neutral", doing: "warning", done: "success" } as const;

export interface GoalCard extends GoalValue {
  id: string;
  /** formatted on the server: "owner · do 31. 3. 2027 · splnené …" */
  meta: string;
}

/** Goal cards of the season's plan with the side panel for editing (design "Klub – plán rozvoja"). */
export function PlanBoard({
  clubId,
  version,
  goals,
  canEdit,
  viewerId,
  members,
  areas,
  suggestions,
}: {
  clubId: string;
  version: number;
  goals: GoalCard[];
  canEdit: boolean;
  viewerId: string;
  members: { userId: string; name: string }[];
  areas: { number: number; name: string }[];
  /** areas offered for the first goals of an empty plan (focus or weakest Kompas areas) */
  suggestions: number[];
}) {
  const t = useTranslations("plan");
  const [editing, setEditing] = useState<number | GoalValue | null>(null);
  const areaName = (n: number) => areas.find((a) => a.number === n)?.name ?? "";
  const nextArea = () =>
    suggestions.find((a) => !goals.some((g) => g.area === a)) ??
    areas.find((a) => !goals.some((g) => g.area === a.number))?.number ??
    1;

  return (
    <div className="flex flex-col gap-3">
      {canEdit && goals.length > 0 && goals.length < MAX_GOALS && (
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          className="self-start"
          onClick={() => setEditing(blankGoal(nextArea()))}
        >
          {t("addGoalShort")}
        </Button>
      )}

      {goals.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description={canEdit ? t("introNew") : undefined}
          action={
            canEdit ? (
              <div className="flex flex-wrap justify-center gap-2">
                {(suggestions.length > 0 ? suggestions : [nextArea()]).map((a) => (
                  <Button key={a} size="sm" icon="plus" onClick={() => setEditing(blankGoal(a))}>
                    {t("addInArea", { area: a, name: areaName(a) })}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((g, i) => (
            <li
              key={g.id}
              className="flex flex-col gap-2 rounded-(--radius-md) bg-(--surface-raised) p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="footnote font-semibold text-(--brand-blue-ink)">
                  {g.area} · {areaName(g.area)}
                </span>
                <Badge tone={TONE[g.status]} dot>
                  {t(`status.${g.status}`)}
                </Badge>
              </div>
              <h2 className="headline break-words">{g.title}</h2>
              <p className="footnote text-(--ink-muted)">{g.meta}</p>
              {g.indicator && (
                <p className="callout">
                  <span className="text-(--ink-muted)">{t("indicator")}: </span>
                  {g.indicator}
                </p>
              )}
              <p className="footnote rounded-(--radius-sm) bg-(--surface) px-3 py-2">
                <span className="text-(--ink-muted)">{t("publicShort")}: </span>
                {g.publicText}
              </p>
              {(canEdit || g.ownerId === viewerId) && (
                <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <GoalStatus
                    key={`${g.id}-${version}`}
                    clubId={clubId}
                    goalId={g.id}
                    status={g.status}
                    version={version}
                  />
                  {canEdit && (
                    <Button variant="tertiary" icon="edit" onClick={() => setEditing(i)}>
                      {t("editGoalShort")}
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <GoalDrawer
          key={typeof editing === "number" ? `goal-${editing}` : `new-${editing.area}`}
          clubId={clubId}
          version={version}
          goals={goals}
          editing={editing}
          onClose={() => setEditing(null)}
          members={members}
          areas={areas}
        />
      )}
    </div>
  );
}
