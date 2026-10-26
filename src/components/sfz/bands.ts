import type { Line } from "@/components/about/formation";
import type { BandKey } from "@/server/services/kompas-scoring";
import type { LicensingBand } from "@/server/services/licensing-rules";

/**
 * One definition of the app's colour scales, only from SFZ tokens (analysis of screens, chapter 6).
 * Replaces the hard-coded palettes repeated in kompas-form, vizitka-view, licensing-form and the Hub.
 * Programme colours (--gold, --program-*) are not allowed in the UI (design system brand book).
 */

/** Design-system Badge tone per Kompas band; the band is always named in words next to the colour. */
export const KOMPAS_BAND_TONE = {
  start: "danger",
  rising: "warning",
  average: "neutral",
  good: "info",
  model: "success",
} as const satisfies Record<BandKey, "danger" | "warning" | "neutral" | "info" | "success">;

/** Licensing bands as a blue scale, lightest to darkest; "none" = no band reached. */
export const LICENSING_BAND_CLASS: Record<LicensingBand | "none", string> = {
  none: "bg-(--surface-raised) text-(--ink-muted) shadow-[inset_0_0_0_1px_var(--border)]",
  grassroots: "bg-(--surface) text-(--ink) shadow-[inset_0_0_0_1px_var(--border-strong)]",
  bronze: "bg-(--brand-blue-tint) text-(--brand-blue-ink)",
  silver: "bg-(--brand-blue) text-(--on-brand)",
  gold: "bg-(--brand-blue-deep) text-(--on-brand)",
};

/** The four lines of the "eleven" (formation) in shades of SFZ blue, decided 26. 10. 2026. */
export const AREA_LINE_CLASS: Record<Line, string> = {
  goalkeeper: "bg-(--brand-blue-deep) text-(--on-brand)",
  defense: "bg-(--brand-blue) text-(--on-brand)",
  midfield: "bg-(--brand-blue-tint) text-(--brand-blue-ink)",
  attack: "bg-(--surface) text-(--ink) shadow-[inset_0_0_0_1px_var(--border-strong)]",
};

/** Clamp a percentage for progress bars; null or NaN counts as 0. */
export function clampPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
