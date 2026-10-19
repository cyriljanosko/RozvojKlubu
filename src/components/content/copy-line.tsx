"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Shows the SFZ-KOMPAS-1 line with a copy button. */
export function CopyLine({ line }: { line: string }) {
  const t = useTranslations("kompas.submit");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{t("line")}</span>
      <code className="bg-muted/50 block overflow-x-auto rounded-md p-2 text-xs whitespace-nowrap">
        {line}
      </code>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(line);
            setCopied(true);
          }}
        >
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        <span role="status" className="text-xs">
          {copied && t("copied")}
        </span>
      </div>
    </div>
  );
}
