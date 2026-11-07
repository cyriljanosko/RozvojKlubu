/** Splits a run duration for the `adminSportnet.duration` message ("1 min 58 s", "42 s"). */
export function durationParts(ms: number): { minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(ms / 1000));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}
