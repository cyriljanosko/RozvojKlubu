/** Football seasons run from 1 July to 30 June, written as "2026/2027". */
const SEASON_RE = /^(\d{4})\/(\d{4})$/;

export function isSeason(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = SEASON_RE.exec(value);
  return m !== null && Number(m[2]) === Number(m[1]) + 1;
}

export function currentSeason(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? year : year - 1; // July = month 6
  return `${start}/${start + 1}`;
}

/** URL-safe form "2026-2027" ↔ "2026/2027". */
export function seasonToSlug(season: string): string {
  return season.replace("/", "-");
}

export function seasonFromSlug(slug: string): string | null {
  const season = slug.replace("-", "/");
  return isSeason(season) ? season : null;
}
