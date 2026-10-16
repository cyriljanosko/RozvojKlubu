import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import type { ClubDoc, ClubSeasonDoc } from "@/server/db/types";
import { isSeason } from "@/server/services/season";

/**
 * Sportnet snapshot as exported in the Vizitka design artifact (ADR 0005).
 * Field names are the artifact's short keys; they are mapped to our model here.
 */
const genderSchema = z.enum(["M", "F"]);

const snapshotSchema = z.object({
  fetched: z.iso.date(),
  clubs: z
    .array(
      z.object({
        app: z.string().min(1),
        nazov: z.string().min(1),
        zv: z.string().min(1),
        rfz: z.string().min(1),
        slug: z.string().min(1),
        seasons: z.record(
          z.string().refine(isSeason, "Invalid season"),
          z.object({
            teams: z.array(
              z.object({
                n: z.string(),
                g: genderSchema,
                a: z.string(),
                lvl: z.enum(["SFZ", "RFZ", "ObFZ"]).nullable(),
                comp: z.array(z.string()),
                pl: z.number().int().nonnegative(),
              }),
            ),
            players: z.array(
              z.object({ a: z.string(), g: genderSchema, n: z.number().int().nonnegative() }),
            ),
            coaches: z.array(
              z.object({
                n: z.string(),
                teams: z.array(z.string()),
                pos: z.array(z.string()),
                lic: z.array(z.string()),
                exp: z.array(z.string()),
              }),
            ),
            otherStaff: z.record(z.string(), z.number().int().nonnegative()),
            uniquePlayers: z.number().int().nonnegative(),
          }),
        ),
      }),
    )
    .min(1),
});

export interface ParsedSnapshot {
  dataAsOf: string;
  clubs: ClubDoc[];
  seasons: ClubSeasonDoc[];
}

export function parseSnapshot(raw: unknown, importedAt: Date = new Date()): ParsedSnapshot {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("BAD_REQUEST", "Invalid snapshot", z.flattenError(parsed.error));
  }
  const { fetched, clubs } = parsed.data;
  const ids = clubs.map((c) => c.app);
  if (new Set(ids).size !== ids.length) {
    throw new ApiError("BAD_REQUEST", "Duplicate club in snapshot");
  }

  return {
    dataAsOf: fetched,
    clubs: clubs.map((c) => ({
      clubId: c.app,
      name: c.nazov,
      union: c.zv,
      region: c.rfz,
      slug: c.slug,
      source: "snapshot",
      dataAsOf: fetched,
      importedAt,
    })),
    seasons: clubs.flatMap((c) =>
      Object.entries(c.seasons).map(([season, s]) => ({
        clubId: c.app,
        season,
        teams: s.teams.map((t) => ({
          name: t.n,
          gender: t.g,
          ageGroup: t.a,
          level: t.lvl,
          competitions: t.comp,
          playerCount: t.pl,
        })),
        players: s.players.map((p) => ({ ageGroup: p.a, gender: p.g, count: p.n })),
        uniquePlayers: s.uniquePlayers,
        coaches: s.coaches.map((co) => ({
          name: co.n,
          teams: co.teams,
          positions: co.pos,
          licences: co.lic,
          expiredLicences: co.exp,
        })),
        otherStaff: s.otherStaff,
        source: "snapshot" as const,
        dataAsOf: fetched,
        importedAt,
      })),
    ),
  };
}

export interface SnapshotStore {
  /** Upserts by clubId / { clubId, season }; returns counts. */
  saveSnapshot: (snapshot: ParsedSnapshot) => Promise<{ clubs: number; seasons: number }>;
}
