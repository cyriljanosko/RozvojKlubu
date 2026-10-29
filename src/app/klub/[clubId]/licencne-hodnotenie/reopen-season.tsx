"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button, Modal } from "@/components/sfz";

import { reopenLicensingAction } from "./actions";

/** Admin-only reopening of a closed season with a confirmation step (ADR 0008). */
export function ReopenSeason({ clubId, season }: { clubId: string; season: string }) {
  const t = useTranslations("licensing.reopen");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      <span className="footnote text-(--ink-muted)">{t("adminOnly")}</span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("button")}
        size="sm"
        footer={
          <>
            <Button
              block
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(false);
                  const res = await reopenLicensingAction(clubId, season);
                  if (res.status === "error") setError(true);
                  else setOpen(false);
                })
              }
            >
              {t("yes")}
            </Button>
            <Button variant="tertiary" block onClick={() => setOpen(false)}>
              {t("no")}
            </Button>
          </>
        }
      >
        <p className="callout">{t("confirm", { season })}</p>
        <p role="status" className="footnote mt-2 text-(--danger)">
          {error && t("error")}
        </p>
      </Modal>
    </div>
  );
}
