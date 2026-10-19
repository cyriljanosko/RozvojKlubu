/**
 * Geometry of the pitch in perspective (H7): the flat pitch in % (x 0–100 left→right,
 * y 0–100 far→near) is projected onto a trapezoid in a fixed SVG box. Wide for larger screens,
 * tall for phones, so the eleven has room on a 375 px screen.
 */
export interface PitchGeometry {
  width: number;
  height: number;
  top: number;
  bottom: number;
  /** far edge (narrower) */
  farLeft: number;
  farRight: number;
  /** near edge (wider) */
  nearLeft: number;
  nearRight: number;
}

export const PITCH_WIDE: PitchGeometry = {
  width: 680,
  height: 470,
  top: 50,
  bottom: 450,
  farLeft: 170,
  farRight: 510,
  nearLeft: 20,
  nearRight: 660,
};

export const PITCH_TALL: PitchGeometry = {
  width: 400,
  height: 560,
  top: 40,
  bottom: 540,
  farLeft: 80,
  farRight: 320,
  nearLeft: 8,
  nearRight: 392,
};

/** Pure: a point of the flat pitch (in %) → SVG coordinates of the pitch in perspective. */
export function project(g: PitchGeometry, x: number, y: number): [number, number] {
  const t = y / 100;
  const left = g.farLeft + (g.nearLeft - g.farLeft) * t;
  const right = g.farRight + (g.nearRight - g.farRight) * t;
  const px = left + ((right - left) * x) / 100;
  const py = g.top + (g.bottom - g.top) * t;
  return [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
}

/** Pure: SVG `points` of flat-pitch points. */
export function toPolygon(g: PitchGeometry, points: [number, number][]): string {
  return points.map(([x, y]) => project(g, x, y).join(",")).join(" ");
}
