"use client";

import { useActionState } from "react";
import { DatabaseZap } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { seedContentAction, type ContentActionState } from "./actions";

export function SeedButton() {
  const t = useTranslations("admin.content.seed");
  const [state, action, pending] = useActionState<ContentActionState>(seedContentAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">{t("hint")}</p>
      <Button type="submit" variant="outline" disabled={pending} className="w-full sm:w-auto">
        <DatabaseZap aria-hidden />
        {t("submit")}
      </Button>
      <p role="status" className="text-sm">
        {state.status === "ok" &&
          t("done", {
            areas: state.areas ?? 0,
            questions: state.questions ?? 0,
            sections: state.sections ?? 0,
            practice: state.practice ?? 0,
            roles: state.roles ?? 0,
          })}
        {state.status === "error" && <span className="text-destructive">{t("error")}</span>}
      </p>
    </form>
  );
}
