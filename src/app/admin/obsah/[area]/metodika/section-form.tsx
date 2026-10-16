"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateSectionAction, type ContentActionState } from "../../actions";

const ERROR_KEYS = ["CONFLICT", "BAD_REQUEST"] as const;

export function SectionForm(props: {
  area: number;
  sectionKey: string;
  title: string;
  body: string;
  validAsOf: string | null;
  reviewedAt: string | null;
  version: number;
}) {
  const t = useTranslations("admin.content.methodology");
  const [state, action, pending] = useActionState<ContentActionState, FormData>(
    updateSectionAction.bind(null, props.area, props.sectionKey),
    { status: "idle" },
  );
  const errorKey =
    state.status === "error" ? (ERROR_KEYS.find((k) => k === state.code) ?? "default") : null;
  const id = (f: string) => `${props.sectionKey}-${f}`;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="expectedVersion" value={props.version} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("title")}>{t("sectionTitle")}</Label>
        <Input id={id("title")} name="title" defaultValue={props.title} required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("body")}>{t("body")}</Label>
        <textarea
          id={id("body")}
          name="body"
          defaultValue={props.body}
          rows={14}
          required
          className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs leading-relaxed"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("validAsOf")}>{t("validAsOf")}</Label>
          <Input
            id={id("validAsOf")}
            name="validAsOf"
            type="date"
            defaultValue={props.validAsOf ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("reviewedAt")}>{t("reviewedAt")}</Label>
          <Input
            id={id("reviewedAt")}
            name="reviewedAt"
            type="date"
            defaultValue={props.reviewedAt ?? ""}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Save aria-hidden />
          {t("save")}
        </Button>
        <span role="status" className="text-xs">
          {state.status === "ok" && t("saved", { version: state.version ?? props.version })}
          {errorKey && <span className="text-destructive">{t(`errors.${errorKey}`)}</span>}
        </span>
      </div>
    </form>
  );
}
