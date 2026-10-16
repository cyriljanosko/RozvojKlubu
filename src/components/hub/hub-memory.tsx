"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const KEY = "hub-selection";
const PARAMS = ["track", "role", "club"] as const;

/** Remembers the Hub selection in this browser and restores it on a bare visit (ADR 0011). */
export function HubMemory() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const current = new URLSearchParams();
      for (const p of PARAMS) {
        const v = params.get(p);
        if (v) current.set(p, v);
      }
      if (current.size > 0) {
        window.localStorage.setItem(KEY, current.toString());
        return;
      }
      const saved = window.localStorage.getItem(KEY);
      if (saved) router.replace(`${pathname}?${saved}`, { scroll: false });
    } catch {
      // storage may be unavailable (private mode); the Hub works without it
    }
  }, [params, pathname, router]);

  return null;
}
