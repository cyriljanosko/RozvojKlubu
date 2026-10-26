import type { ReactNode } from "react";

import type { Line } from "@/components/about/formation";
import type { BandKey } from "@/server/services/kompas-scoring";
import type { LicensingBand } from "@/server/services/licensing-rules";

import { AREA_LINE_CLASS, KOMPAS_BAND_TONE, LICENSING_BAND_CLASS } from "./bands";
import { Badge } from "./ds";

/** Kompas band as a design-system Badge; `children` is the translated band name. */
export function KompasBandBadge({ band, children }: { band: BandKey; children: ReactNode }) {
  return <Badge tone={KOMPAS_BAND_TONE[band]}>{children}</Badge>;
}

/** Licensing band pill on the blue scale; `children` is the translated band name. */
export function LicensingBandPill({
  band,
  children,
}: {
  band: LicensingBand | "none";
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-[13px] font-semibold ${LICENSING_BAND_CLASS[band]}`}
    >
      {children}
    </span>
  );
}

/** Area number in the colour of its line of the eleven. */
export function AreaNumber({
  number,
  line,
  label,
}: {
  number: number;
  line: Line;
  label?: string;
}) {
  return (
    <span
      className={`inline-grid size-8 shrink-0 place-items-center rounded-(--radius-sm) text-[15px] font-bold ${AREA_LINE_CLASS[line]}`}
      aria-label={label}
    >
      {number}
    </span>
  );
}
