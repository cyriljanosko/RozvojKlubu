"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { FavoriteKind } from "@/server/db/types";

import { pinAction, unpinAction } from "./actions";

/**
 * "Pripnúť do Moja Akadémia" (MD-c): a star that pins or unpins the page or its part.
 * Rendered only for signed-in users; works inside a <summary> without toggling it.
 */
export function PinButton({
  kind,
  href,
  label,
  pinned: initial,
  className = "",
}: {
  kind: FavoriteKind;
  href: string;
  label: string;
  pinned: boolean;
  className?: string;
}) {
  const t = useTranslations("favorites");
  const [pinned, setPinned] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !pinned;
    setPinned(next); // optimistic
    setMessage(null);
    startTransition(async () => {
      const res = next ? await pinAction({ kind, href, label }) : await unpinAction({ href });
      if (res.status === "ok") return;
      setPinned(!next);
      setMessage(t(res.code === "FAVORITES_FULL" ? "full" : "error"));
    });
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        aria-pressed={pinned}
        aria-label={pinned ? t("unpin", { label }) : t("pin", { label })}
        title={pinned ? t("unpinShort") : t("pinShort")}
        disabled={pending}
        onClick={(e) => {
          // inside <summary>: do not open or close the section
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        className="hover:bg-muted text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md aria-pressed:text-amber-500"
      >
        <Star aria-hidden className="size-4" fill={pinned ? "currentColor" : "none"} />
      </button>
      {message && (
        <span role="status" className="text-destructive text-xs">
          {message}
        </span>
      )}
    </span>
  );
}
