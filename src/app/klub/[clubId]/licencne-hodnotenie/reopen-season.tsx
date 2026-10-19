"use client";

import { useState, useTransition } from "react";
import { LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { reopenLicensingAction } from "./actions";

/** Admin-only reopening of a closed season with a confirmation step (ADR 0008). */
export function ReopenSeason({ clubId, season }: { clubId: string; season: string }) {
  const t = useTranslations("licensing.reopen");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirm) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(true)}>
          <LockOpen aria-hidden />
          {t("button")}
        </Button>
        <span className="text-muted-foreground text-xs">{t("adminOnly")}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p>{t("confirm", { season })}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await reopenLicensingAction(clubId, season);
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
