"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { BoardView, type BoardPanel, type Layout } from "@/components/analytics/panel-board";

import { saveDashboardAction } from "./actions";

const EMPTY: Layout = { order: [], hidden: [] };

/** Moja Akadémia tiles; the layout is saved in the account, so it follows the user (MD-b, ADR 0012). */
export function DashboardBoard({
  panels,
  layout: initial,
  version: initialVersion,
}: {
  panels: BoardPanel[];
  layout: Layout;
  version: number;
}) {
  const t = useTranslations("board");
  const router = useRouter();
  const [layout, setLayout] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(0);
  // saves run one after another, each with the version the previous one returned
  const version = useRef(initialVersion);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const change = (next: Layout | null) => {
    const value = next ?? EMPTY;
    setLayout(value); // optimistic – the tiles move at once
    setError(false);
    setPending((n) => n + 1);
    queue.current = queue.current.then(async () => {
      const res = await saveDashboardAction(value, version.current).catch(() => null);
      setPending((n) => n - 1);
      if (res?.status === "ok") {
        version.current = res.version;
        return;
      }
      setError(true);
      // changed in another tab or device – take the saved layout
      if (res?.code === "CONFLICT") router.refresh();
    });
  };

  return (
    <>
      <BoardView panels={panels} layout={layout} onChange={change} pending={pending > 0} />
      {error && (
        <p role="status" className="text-destructive text-sm">
          {t("saveError")}
        </p>
      )}
    </>
  );
}
