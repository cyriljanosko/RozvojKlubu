const TONE = {
  kompas: "text-blue-600 dark:text-blue-400",
  licensing: "text-orange-700 dark:text-orange-400",
} as const;

/**
 * Five stars of a ranking (VK-b): filled ones in the colour of the rating (Kompas blue,
 * licensing orange), the rest muted; screen readers get `label` instead of the glyphs.
 */
export function Stars({
  value,
  tone,
  label,
}: {
  value: number;
  tone: keyof typeof TONE;
  label: string;
}) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span role="img" aria-label={label} className="text-base leading-none tracking-wide">
      <span className={TONE[tone]} aria-hidden>
        {"★".repeat(full)}
      </span>
      <span className="text-muted-foreground/40" aria-hidden>
        {"★".repeat(5 - full)}
      </span>
    </span>
  );
}
