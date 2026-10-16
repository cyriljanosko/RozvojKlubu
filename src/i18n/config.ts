import sk from "../../messages/sk.json";

/**
 * i18n configuration. Slovak is the default and the fallback language.
 * CS/EN will be added as messages/cs.json and messages/en.json; any missing
 * key falls back to Slovak, never to the raw key.
 */
export const LOCALES = ["sk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "sk";

export type Messages = typeof sk;
type Tree = { [key: string]: string | Tree };

/** Deep-merges `override` onto `base` (used to fall back to Slovak). */
export function withFallback<T extends Tree>(base: T, override: Tree | undefined): T {
  if (!override) return base;
  const result: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    result[key] =
      typeof value === "object" && typeof baseValue === "object"
        ? withFallback(baseValue, value)
        : value;
  }
  return result as T;
}

/**
 * Returns messages for a locale. When CS/EN are added, import their JSON here
 * and return `withFallback(sk, cs)` so missing keys fall back to Slovak.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "sk":
      return sk;
  }
}

export const defaultMessages: Messages = sk;
