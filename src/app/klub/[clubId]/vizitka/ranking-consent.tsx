"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/sfz";

import { setRankingConsentAction } from "./actions";

/** Management gives or withdraws the consent to the public rankings (MR-c, ADR 0015). */
export function RankingConsentToggle({
  clubId,
  given,
  version,
}: {
  clubId: string;
  /** null = not decided yet */
  given: boolean | null;
  version: number;
}) {
  const t = useTranslations("ranking.consent");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (value: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await setRankingConsentAction(clubId, value, version);
      if (res.status === "error") setError(t(`errors.${res.code}`));
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {given !== true && (
          <Button size="sm" loading={pending} onClick={() => save(true)}>
            {t("give")}
          </Button>
        )}
        {given !== false && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => save(false)}>
            {given === true ? t("withdraw") : t("decline")}
          </Button>
        )}
      </div>
      <span role="status" className="footnote text-(--danger)">
        {error}
      </span>
    </div>
  );
}
