"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button, Modal } from "@/components/sfz";

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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (value: boolean) =>
    startTransition(async () => {
      setError(false);
      const res = await confirmSubmissionAction(clubId, submissionId, value);
      if (res.status === "error") setError(true);
      else setOpen(false);
    });
  return (
    <div className="flex flex-col gap-3">
      <p className="callout">{t("hint")}</p>
      {confirmed ? (
        <Button variant="secondary" loading={pending} onClick={() => run(false)}>
          {t("undo")}
        </Button>
      ) : (
        <Button icon="check-circle" block onClick={() => setOpen(true)}>
          {t("button")}
        </Button>
      )}
      <span role="status" className="footnote text-(--danger)">
        {error && t("error")}
      </span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("modalTitle")}
        size="sm"
        footer={
          <>
            <Button block loading={pending} onClick={() => run(true)}>
              {t("button")}
            </Button>
            <Button variant="tertiary" block onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </>
        }
      >
        <p className="callout">{t("modalBody")}</p>
      </Modal>
    </div>
  );
}
