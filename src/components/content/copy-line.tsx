"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/sfz";

/** Shows the SFZ-KOMPAS-1 line with a copy button. */
export function CopyLine({ line }: { line: string }) {
  const t = useTranslations("kompas.submit");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="footnote text-(--ink-muted)">{t("line")}</span>
      <code className="footnote block overflow-x-auto rounded-(--radius-sm) bg-(--surface) p-2 whitespace-nowrap">
        {line}
      </code>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? "check" : undefined}
          onClick={async () => {
            await navigator.clipboard.writeText(line);
            setCopied(true);
          }}
        >
          {t("copy")}
        </Button>
        <span role="status" className="footnote">
          {copied && t("copied")}
        </span>
      </div>
    </div>
  );
}
