import type { QuestionColumn, QuestionTag, TeamSummary } from "@/server/db/types";

/**
 * Kompas klubu – pure scoring rules (taken over from the Kompas v2 design, see the product map).
 * - A question with age tags applies only when the club has one of those categories;
 *   no tags or "rast" = always; a club without any age category sees every question.
 * - Column points = round(checked valid / valid × 10); fewer than 3 valid questions → area not scored.
 * - Area = i + s (0–20), total of filled areas (max 220), five bands.
 */

/** Club categories as used by question tags (S = adults; zd = women and girls). */
export type ClubCategory = Exclude<QuestionTag, "rast">;

export const MIN_VALID_QUESTIONS = 3;

export const BANDS = [
  { band: 1, min: 0, max: 4, key: "start" },
  { band: 2, min: 5, max: 8, key: "rising" },
  { band: 3, min: 9, max: 12, key: "average" },
  { band: 4, min: 13, max: 16, key: "good" },
  { band: 5, min: 17, max: 20, key: "model" },
] as const;
export type BandKey = (typeof BANDS)[number]["key"];

export function bandOf(points: number): (typeof BANDS)[number] {
  const p = Math.max(0, Math.min(20, Math.round(points)));
  return BANDS.find((b) => p >= b.min && p <= b.max) ?? BANDS[0];
}

/** Every club category, in display order; the trial Kompas without a club assumes all of them. */
export const ALL_CATEGORIES: readonly ClubCategory[] = ["D", "Z", "DO", "S", "zd"];

/** Categories from the club's teams in Sportnet: U06–U11 → D, U12–U15 → Z, U16–U19 → DO, U21/ADULTS → S, any women's team → zd. */
export function clubCategories(
  teams: readonly Pick<TeamSummary, "ageGroup" | "gender">[],
): ClubCategory[] {
  const out = new Set<ClubCategory>();
  for (const t of teams) {
    if (t.gender === "F") out.add("zd");
    const m = /^U(\d{2})$/.exec(t.ageGroup);
    if (t.ageGroup === "ADULTS" || (m && Number(m[1]) >= 20)) out.add("S");
    else if (m) {
      const age = Number(m[1]);
      out.add(age <= 11 ? "D" : age <= 15 ? "Z" : "DO");
    }
  }
  return ALL_CATEGORIES.filter((c) => out.has(c));
}

export interface ScoringQuestion {
  questionId: string;
  area: number;
  column: QuestionColumn;
  order: number;
  text: string;
  tags: readonly QuestionTag[];
}

export function isQuestionValid(
  tags: readonly QuestionTag[],
  categories: readonly ClubCategory[],
): boolean {
  if (tags.length === 0 || tags.includes("rast")) return true;
  if (!categories.some((c) => c !== "zd")) return true;
  return tags.some((t) => t !== "rast" && categories.includes(t));
}

export interface ColumnResult {
  valid: number;
  checked: number;
  /** null when fewer than MIN_VALID_QUESTIONS valid questions */
  points: number | null;
}

export interface AreaResult {
  area: number;
  columns: Record<QuestionColumn, ColumnResult>;
  /** true when at least one valid question is checked */
  filled: boolean;
  /** "few" = not scored because a column has too few valid questions */
  status: "empty" | "few" | "scored";
  points: number | null;
  band: BandKey | null;
}

export interface KompasResult {
  categories: ClubCategory[];
  areas: AreaResult[];
  filledAreas: number;
  total: number;
  average: number | null;
  band: BandKey | null;
  /** Up to three weakest scored areas, with up to three unchecked valid questions as tasks. */
  next: { area: number; points: number; tasks: { questionId: string; text: string }[] }[];
}

export function scoreKompas(
  questions: readonly ScoringQuestion[],
  categories: readonly ClubCategory[],
  checkedIds: Iterable<string>,
): KompasResult {
  const checked = new Set(checkedIds);
  const byArea = new Map<number, ScoringQuestion[]>();
  for (const q of questions) byArea.set(q.area, [...(byArea.get(q.area) ?? []), q]);

  const areas: AreaResult[] = [...byArea.keys()]
    .sort((a, b) => a - b)
    .map((area) => {
      const qs = byArea.get(area)!;
      const column = (col: QuestionColumn): ColumnResult => {
        const valid = qs.filter((q) => q.column === col && isQuestionValid(q.tags, categories));
        const hits = valid.filter((q) => checked.has(q.questionId)).length;
        return {
          valid: valid.length,
          checked: hits,
          points:
            valid.length < MIN_VALID_QUESTIONS ? null : Math.round((hits / valid.length) * 10),
        };
      };
      const columns = { i: column("i"), s: column("s") };
      const filled = columns.i.checked + columns.s.checked > 0;
      const few = columns.i.points === null || columns.s.points === null;
      const points = filled && !few ? columns.i.points! + columns.s.points! : null;
      return {
        area,
        columns,
        filled,
        status: few ? "few" : filled ? "scored" : "empty",
        points,
        band: points === null ? null : bandOf(points).key,
      };
    });

  const scored = areas.filter((a) => a.points !== null);
  const total = scored.reduce((sum, a) => sum + a.points!, 0);
  const average = scored.length ? total / scored.length : null;

  const next = [...scored]
    .sort((a, b) => a.points! - b.points! || a.area - b.area)
    .slice(0, 3)
    .map((a) => ({
      area: a.area,
      points: a.points!,
      tasks: byArea
        .get(a.area)!
        .filter((q) => isQuestionValid(q.tags, categories) && !checked.has(q.questionId))
        .sort((x, y) => x.column.localeCompare(y.column) || x.order - y.order)
        .slice(0, 3)
        .map((q) => ({ questionId: q.questionId, text: q.text })),
    }));

  return {
    categories: [...categories],
    areas,
    filledAreas: scored.length,
    total,
    average,
    band: average === null ? null : bandOf(average).key,
    next,
  };
}
