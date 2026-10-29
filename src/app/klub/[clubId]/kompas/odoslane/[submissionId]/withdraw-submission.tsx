"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button, Modal } from "@/components/sfz";

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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button variant="danger" size="sm" className="self-start" onClick={() => setOpen(true)}>
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
              variant="danger"
              block
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(false);
                  const res = await withdrawSubmissionAction(clubId, submissionId);
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
        <p className="callout">{t("confirm")}</p>
        <p role="status" className="footnote mt-2 text-(--danger)">
          {error && t("error")}
        </p>
      </Modal>
    </div>
  );
}
