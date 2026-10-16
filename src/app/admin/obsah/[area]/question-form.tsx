"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { QUESTION_TAGS, type QuestionTag } from "@/server/db/types";

import { updateQuestionAction, type ContentActionState } from "../actions";

const ERROR_KEYS = ["CONFLICT", "BAD_REQUEST"] as const;

export function QuestionForm({
  questionId,
  text,
  tags,
  version,
}: {
  questionId: string;
  text: string;
  tags: QuestionTag[];
  version: number;
}) {
  const t = useTranslations("admin.content.question");
  const tTags = useTranslations("questionTags");
  const [state, action, pending] = useActionState<ContentActionState, FormData>(
    updateQuestionAction.bind(null, questionId),
    { status: "idle" },
  );
  const errorKey =
    state.status === "error" ? (ERROR_KEYS.find((k) => k === state.code) ?? "default") : null;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="expectedVersion" value={version} />
      <label className="sr-only" htmlFor={`q-${questionId}`}>
        {t("text")}
      </label>
      <textarea
        id={`q-${questionId}`}
        name="text"
        defaultValue={text}
        rows={3}
        required
        minLength={5}
        maxLength={500}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-muted-foreground mb-1 text-xs">{t("tags")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {QUESTION_TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" name="tags" value={tag} defaultChecked={tags.includes(tag)} />
              {tTags(tag)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Save aria-hidden />
          {t("save")}
        </Button>
        <span role="status" className="text-xs">
          {state.status === "ok" && t("saved", { version: state.version ?? version })}
          {errorKey && <span className="text-destructive">{t(`errors.${errorKey}`)}</span>}
        </span>
      </div>
    </form>
  );
}
