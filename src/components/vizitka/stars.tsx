/** Both ratings on the SFZ blue scale (decision 28. 10. 2026); the label names which one it is. */
const TONE = {
  kompas: "text-(--brand-blue-ink)",
  licensing: "text-(--brand-blue-deep) dark:text-(--brand-blue-ink)",
} as const;

/**
 * Five stars of a ranking (VK-b): filled ones in SFZ blue, the rest muted;
 * screen readers get `label` instead of the glyphs.
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
      <span className="text-(--hairline)" aria-hidden>
        {"★".repeat(5 - full)}
      </span>
    </span>
  );
}
