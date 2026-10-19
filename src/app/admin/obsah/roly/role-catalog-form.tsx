"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { updateRoleCatalogAction, type ContentActionState } from "../actions";

const ERROR_KEYS = ["CONFLICT", "BAD_REQUEST"] as const;

export function RoleCatalogForm(props: { json: string; version: number }) {
  const t = useTranslations("admin.content");
  const [state, action, pending] = useActionState<ContentActionState, FormData>(
    updateRoleCatalogAction,
    { status: "idle" },
  );
  const errorKey =
    state.status === "error" ? (ERROR_KEYS.find((k) => k === state.code) ?? "default") : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="expectedVersion" value={props.version} />
      <p className="text-muted-foreground text-xs">{t("roles.hint")}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roles-json">{t("roles.json")}</Label>
        <textarea
          id="roles-json"
          name="content"
          defaultValue={props.json}
          rows={28}
          spellCheck={false}
          required
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Save aria-hidden />
          {t("question.save")}
        </Button>
        <span role="status" className="text-xs">
          {state.status === "ok" &&
            t("question.saved", { version: state.version ?? props.version })}
          {errorKey && <span className="text-destructive">{t(`roles.errors.${errorKey}`)}</span>}
        </span>
      </div>
    </form>
  );
}
