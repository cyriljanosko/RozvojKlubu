"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { withdrawSubmissionAction } from "./actions";

/** Admin-only withdrawal of a submitted Kompas with a confirmation step (ADR 0009). */
export function WithdrawSubmission({
  clubId,
  submissionId,
}: {
  clubId: string;
  submissionId: string;
}) {
  const t = useTranslations("kompas.withdraw");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(true)}>
          <Undo2 aria-hidden />
          {t("button")}
        </Button>
        <span className="text-muted-foreground text-xs">{t("adminOnly")}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{t("confirm")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await withdrawSubmissionAction(clubId, submissionId);
              if (res.status === "error") setError(true);
            })
          }
        >
          {t("yes")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(false)}>
          {t("no")}
        </Button>
      </div>
      <span role="status" className="text-xs">
        {error && t("error")}
      </span>
    </div>
  );
}
