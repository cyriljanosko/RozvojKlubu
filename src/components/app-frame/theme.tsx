"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Select } from "@/components/sfz";

import { THEME_KEY } from "./theme-script";

type Theme = "system" | "light" | "dark";

const listeners = new Set<() => void>();
const read = (): Theme => {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};

function apply(theme: Theme) {
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked – the choice holds until the page reloads
  }
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

export function ThemeSelect() {
  const t = useTranslations("account.theme");
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "system" as Theme,
  );
  return (
    <Select
      label={t("label")}
      value={theme}
      onChange={(e) => apply(e.target.value as Theme)}
      options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: t(v) }))}
    />
  );
}
