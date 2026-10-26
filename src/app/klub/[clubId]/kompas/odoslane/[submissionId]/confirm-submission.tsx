"use client";

import { useState, useTransition } from "react";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { confirmSubmissionAction } from "./actions";

/** The club's mentor or admin_sfz confirms the submitted Kompas – a badge (MR-c, ADR 0015). */
export function ConfirmSubmission({
  clubId,
  submissionId,
  confirmed,
}: {
  clubId: string;
  submissionId: string;
  confirmed: boolean;
}) {
  const t = useTranslations("kompas.confirm");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (value: boolean) =>
    startTransition(async () => {
      setError(false);
      const res = await confirmSubmissionAction(clubId, submissionId, value);
      if (res.status === "error") setError(true);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmed ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(false)}
        >
          {t("undo")}
        </Button>
      ) : (
        <Button type="button" size="sm" disabled={pending} onClick={() => run(true)}>
          <BadgeCheck aria-hidden />
          {t("button")}
        </Button>
      )}
      <span className="text-muted-foreground text-xs">{t("hint")}</span>
      <span role="status" className="text-destructive text-xs">
        {error && t("error")}
      </span>
    </div>
  );
}
