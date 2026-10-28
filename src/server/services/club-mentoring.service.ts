import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { ClubMentoringDoc, MentoringClosingClub } from "@/server/db/types";
import { clubRolesFor, isAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import { currentSeason, seasonFromSlug } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * The club's mentoring cycle of a season (MC, decisions 22. 10. 2026), modelled on the EYA coach
 * mentoring: ① the club's opening self-assessment (management), ② the mentor's development focus,
 * ③ the visits (`mentor_visits`), ④ the closing – the club's review and the mentor's assessment with
 * the plan for the next season.
 * - management writes the club parts, the club's mentor of the season the mentor parts, admin_sfz all;
 * - coaches read, except the club's remarks on the mentoring (only the mentor, admin_sfz and
 *   management, who wrote them);
 * - one document per club and season, every query by clubId (ADR 0003).
 */
export interface MentoringStore {
  findMentoring: (clubId: string, season: string) => Promise<ClubMentoringDoc | null>;
  /** optimistic: expectedVersion 0 creates; null on a version conflict */
  saveMentoring: (
    clubId: string,
    season: string,
    expectedVersion: number,
    changes: Partial<Pick<ClubMentoringDoc, MentoringPartKey>> &
      Pick<ClubMentoringDoc, "updatedAt" | "updatedBy">,
  ) => Promise<ClubMentoringDoc | null>;
}

export interface MentoringDeps extends ClubDeps {
  mentoring: MentoringStore;
}

export type MentoringPartKey = "intro" | "focus" | "closingClub" | "closingMentor";
export type MentoringRole = "admin" | "mentor" | "management" | "coach";

const text = (max = 3000) => z.string().trim().max(max);

/** Input of each part; `expectedVersion` 0 creates the season's document. */
export const mentoringPartSchemas = {
  intro: z.object({
    strengths: text(),
    weaknesses: text(),
    improve: text(),
    expectations: text(),
  }),
  focus: z.object({
    strengths: text(),
    weaknesses: text(),
    recommendations: text(),
    assessment: text(),
    areas: z
      .array(z.number().int().min(1).max(11))
      .min(1)
      .max(3)
      .transform((a) => [...new Set(a)].sort((x, y) => x - y)),
  }),
  closingClub: z.object({
    stepsReview: text(),
    feedback: text(),
    selfAssessment: text(),
  }),
  closingMentor: z.object({
    assessment: text(),
    nextPlan: text(),
  }),
} as const;

const WRITERS: Record<MentoringPartKey, readonly MentoringRole[]> = {
  intro: ["management", "admin"],
  closingClub: ["management", "admin"],
  focus: ["mentor", "admin"],
  closingMentor: ["mentor", "admin"],
};

/** Pure: may this role write the part? */
export const canWrite = (role: MentoringRole, part: MentoringPartKey) =>
  WRITERS[part].includes(role);

/** Pure: the club's remarks on the mentoring – not for coaches (decision 22. 10. 2026). */
export const seesFeedback = (role: MentoringRole) => role !== "coach";

/** Every mentoring role of the user in the club, the main one first (mentor before management):
 *  a mentor who is also the club's management writes both the club and the mentor parts. */
async function rolesFor(
  deps: MentoringDeps,
  user: CurrentUser,
  clubId: string,
): Promise<MentoringRole[]> {
  if (isAdmin(user)) return ["admin"];
  const season = currentSeason(deps.now?.() ?? new Date());
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  const found = (["mentor", "management", "coach"] as const).filter((r) => roles.includes(r));
  if (found.length === 0) throw new ApiError("FORBIDDEN", "No access to this club's mentoring");
  return found;
}

export interface MentoringView {
  clubId: string;
  season: string;
  /** the viewer's main role (mentor before management) */
  role: MentoringRole;
  /** parts the viewer may write (current season only) */
  writes: MentoringPartKey[];
  intro: ClubMentoringDoc["intro"];
  focus: ClubMentoringDoc["focus"];
  /** `feedback` is null when the viewer may not read it */
  closingClub: (Omit<MentoringClosingClub, "feedback"> & { feedback: string | null }) | null;
  closingMentor: ClubMentoringDoc["closingMentor"];
  /** 0 = nothing saved yet this season */
  version: number;
  /** ①–④ filled in, for the timeline and overviews */
  done: Record<MentoringPartKey, boolean>;
}

/** Pure: what the viewer sees of the season's document. */
export function mentoringView(
  doc: ClubMentoringDoc | null,
  meta: { clubId: string; season: string; roles: MentoringRole[]; current: boolean },
): MentoringView {
  const closingClub = doc?.closingClub ?? null;
  return {
    clubId: meta.clubId,
    season: meta.season,
    role: meta.roles[0],
    writes: meta.current
      ? (Object.keys(WRITERS) as MentoringPartKey[]).filter((p) =>
          meta.roles.some((r) => canWrite(r, p)),
        )
      : [],
    intro: doc?.intro ?? null,
    focus: doc?.focus ?? null,
    closingClub: closingClub
      ? { ...closingClub, feedback: meta.roles.some(seesFeedback) ? closingClub.feedback : null }
      : null,
    closingMentor: doc?.closingMentor ?? null,
    version: doc?.version ?? 0,
    done: {
      intro: Boolean(doc?.intro),
      focus: Boolean(doc?.focus),
      closingClub: Boolean(doc?.closingClub),
      closingMentor: Boolean(doc?.closingMentor),
    },
  };
}

async function requireClub(deps: MentoringDeps, clubId: string) {
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
}

/** `?season=` as the URL slug "2025-2026" like other pages; the older "2025/2026" form still works. */
const seasonSchema = z
  .string()
  .transform((value, ctx) => {
    const season = seasonFromSlug(value);
    if (!season) ctx.addIssue({ code: "custom", message: "Invalid season" });
    return season ?? z.NEVER;
  })
  .nullish();

export async function getClubMentoring(
  deps: MentoringDeps,
  actor: CurrentUser | null,
  clubId: string,
  season?: string | null,
): Promise<MentoringView> {
  const user = requireUser(actor);
  const roles = await rolesFor(deps, user, clubId);
  await requireClub(deps, clubId);
  const now = currentSeason(deps.now?.() ?? new Date());
  const wanted = seasonSchema.parse(season) ?? now;
  return mentoringView(await deps.mentoring.findMentoring(clubId, wanted), {
    clubId,
    season: wanted,
    roles,
    current: wanted === now,
  });
}

/** Saves one part of the current season's cycle (each part replaces itself as a whole). */
export async function saveMentoringPart(
  deps: MentoringDeps,
  actor: CurrentUser | null,
  clubId: string,
  part: MentoringPartKey,
  input: unknown,
): Promise<MentoringView> {
  const user = requireUser(actor);
  const roles = await rolesFor(deps, user, clubId);
  if (!roles.some((r) => canWrite(r, part))) {
    throw new ApiError("FORBIDDEN", `This role cannot write the ${part} part`);
  }
  await requireClub(deps, clubId);
  const { expectedVersion, ...fields } = mentoringPartSchemas[part]
    .extend({ expectedVersion: z.number().int().min(0) })
    .parse(input);
  const now = deps.now?.() ?? new Date();
  const season = currentSeason(now);
  const saved = await deps.mentoring.saveMentoring(clubId, season, expectedVersion, {
    [part]: { ...fields, savedAt: now, savedBy: user.id },
    updatedAt: now,
    updatedBy: user.id,
  });
  if (!saved) throw new ApiError("CONFLICT", "The mentoring was changed by someone else");
  return mentoringView(saved, { clubId, season, roles, current: true });
}

export type MentoringStatus = Record<MentoringPartKey, boolean>;

/** Pure: which parts of the season's cycle are filled in (tasks, dashboard, overviews – MC-d). */
export function mentoringStatus(
  doc: Pick<ClubMentoringDoc, MentoringPartKey> | null,
): MentoringStatus {
  return {
    intro: Boolean(doc?.intro),
    focus: Boolean(doc?.focus),
    closingClub: Boolean(doc?.closingClub),
    closingMentor: Boolean(doc?.closingMentor),
  };
}

/** Pure: the closing is due in the last two months of the season (May, June – season ends 30. 6.). */
export const closingDue = (now: Date) => {
  const month = Number(
    now.toLocaleDateString("en-US", { month: "numeric", timeZone: "Europe/Bratislava" }),
  );
  return month === 5 || month === 6;
};
