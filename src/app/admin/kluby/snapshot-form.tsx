"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { importSnapshotAction, type ActionState } from "./actions";

export function SnapshotForm() {
  const t = useTranslations("admin.snapshot");
  const format = useFormatter();
  const [state, action, pending] = useActionState<ActionState, FormData>(importSnapshotAction, {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="snapshot-file">{t("file")}</Label>
        <input
          id="snapshot-file"
          name="file"
          type="file"
          accept="application/json,.json"
          required
          className="text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        <Upload aria-hidden />
        {t("submit")}
      </Button>
      <p role="status" className="text-sm">
        {state.status === "ok" &&
          t("done", {
            clubs: state.clubs ?? 0,
            seasons: state.seasons ?? 0,
            date: state.dataAsOf
              ? format.dateTime(new Date(state.dataAsOf), { dateStyle: "long" })
              : "",
          })}
        {state.status === "error" && <span className="text-destructive">{t("error")}</span>}
      </p>
    </form>
  );
}
