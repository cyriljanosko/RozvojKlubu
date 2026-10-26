import { clampPercent } from "./bands";

interface ProgressBarProps {
  /** 0–100; values outside are clamped. */
  value: number | null;
  /** Accessible name, e.g. "Vyplnené oblasti Kompasu". */
  label: string;
  /** Text read out instead of the bare percentage, e.g. "8 z 11 oblastí". */
  valueText?: string;
  tone?: "brand" | "success";
}

/** Progress bar from tokens (the design system has none yet, ADR 0018). */
export function ProgressBar({ value, label, valueText, tone = "brand" }: ProgressBarProps) {
  const pct = clampPercent(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={valueText}
      className="h-2 overflow-hidden rounded-full bg-(--surface-raised)"
    >
      <div
        className={`h-full rounded-full ${tone === "success" ? "bg-(--success)" : "bg-(--brand-blue)"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
