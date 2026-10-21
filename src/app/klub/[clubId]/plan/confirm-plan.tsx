"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { confirmPlanAction } from "./actions";

/** The club's mentor (or admin_sfz) confirms the plan – or takes the confirmation back. */
export function ConfirmPlan({
  clubId,
  confirmed,
  version,
}: {
  clubId: string;
  confirmed: boolean;
  version: number;
}) {
  const t = useTranslations("plan");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={confirmed ? "outline" : "default"}
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await confirmPlanAction(clubId, !confirmed, version);
            setError(res.status === "error");
          })
        }
      >
        {confirmed ? t("unconfirm") : t("confirm")}
      </Button>
      {error && <p className="text-destructive text-xs">{t("errors.INTERNAL")}</p>}
    </div>
  );
}
