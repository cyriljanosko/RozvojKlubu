"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { FavoriteKind } from "@/server/db/types";

import { orderFavoritesAction, unpinAction } from "./actions";

export interface FavoriteItem {
  id: string;
  kind: FavoriteKind;
  href: string;
  label: string;
}

/** The Obľúbené tile (MD-c): pinned pages with arrows and unpin; saved in the account. */
export function FavoritesList({ favorites: initial }: { favorites: FavoriteItem[] }) {
  const t = useTranslations("favorites");
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState(false);
  // changes run one after another, so the server sees them in the order they were made
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (work: () => ReturnType<typeof unpinAction>) => {
    setError(false);
    queue.current = queue.current.then(async () => {
      const res = await work().catch(() => null);
      if (res?.status === "ok") return;
      setError(true);
      router.refresh();
    });
  };

  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setItems(next);
    enqueue(() => orderFavoritesAction(next.map((f) => f.id)));
  };

  const remove = (id: string) => {
    setItems((list) => list.filter((f) => f.id !== id));
    enqueue(() => unpinAction({ id }));
  };

  if (items.length === 0) return <p className="text-muted-foreground text-sm">{t("tile.empty")}</p>;
  return (
    <>
      <ul className="flex flex-col divide-y rounded-md border">
        {items.map((f, i) => (
          <li key={f.id} className="flex items-center gap-1 py-1 pr-1 pl-3 text-sm">
            <Link href={f.href} className="min-w-0 flex-1 py-1 hover:underline">
              <span className="block break-words">{f.label}</span>
              <span className="text-muted-foreground text-xs">{t(`tile.kind.${f.kind}`)}</span>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={i === 0}
              aria-label={t("tile.up", { label: f.label })}
              onClick={() => move(i, -1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={i === items.length - 1}
              aria-label={t("tile.down", { label: f.label })}
              onClick={() => move(i, 1)}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t("tile.remove", { label: f.label })}
              onClick={() => remove(f.id)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="status" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </>
  );
}
