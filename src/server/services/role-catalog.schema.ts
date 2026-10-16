import { z } from "zod";

/**
 * Role catalog (ADR 0010): base roles (who someone is in the club) and roles in the 11 areas
 * (what they do there). Managed content, edited by admin_sfz; the 16. 10. 2026 seed is the
 * proposal "Roly v 11 oblastiach" v1 (areas 3 and 4 approved).
 */
const key = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const status = z.enum(["approved", "proposal"]);

export const baseRoleSchema = z.object({
  key,
  name: text(80),
  status,
  /** shown only on the public Hub, never assigned in a club (e.g. fan, ADR 0011) */
  publicOnly: z.boolean().optional(),
  /** club role (ADR 0004) this base role is assigned through, if any */
  clubRole: z.enum(["management", "coach", "mentor"]).optional(),
  note: text(500).optional(),
  rules: z.array(text(300)).max(20).optional(),
});

export const areaRoleSchema = z.object({
  key,
  name: text(120),
  who: text(300),
  does: text(500),
  baseRoles: z.array(key).min(1).max(6),
  /** role key in the area's Prax (content/prax), when the area has practice */
  practiceRole: z
    .string()
    .regex(/^[a-z]{1,4}$/)
    .optional(),
  /** overrides the area status for a single role (e.g. a proposed role in an approved area) */
  status: status.optional(),
});

/** A role lens on the public Hub (ADR 0011): area order, a sentence per area, "Začnite tu" and who it is. */
export const hubRoleSchema = z.object({
  key,
  name: text(80),
  /** base role behind the lens; none for "whole club" and for the professional academy track */
  baseRole: key.optional(),
  /** areas shown first, in this order; the rest follow 1–11 */
  order: z.array(z.number().int().min(1).max(11)).max(11),
  /** one sentence per area for this role, keyed "1".."11" */
  lines: z.record(z.string().regex(/^(?:[1-9]|1[01])$/), text(400)),
  start: z
    .object({
      title: text(160),
      text: text(600),
      steps: z
        .array(z.object({ title: text(160), text: text(400) }))
        .min(1)
        .max(5),
      /** call to action: an area number, or 0 for the Kompas */
      cta: z.object({ label: text(160), area: z.number().int().min(0).max(11) }),
    })
    .optional(),
  info: z.object({ who: text(400), see: text(400), why: text(400) }),
  /** text proposed by Claude, not yet reviewed (ADR 0011) */
  draft: z.boolean().optional(),
});

export const trackSchema = z.object({
  key,
  name: text(80),
  status: z.enum(["approved", "preparing"]),
  intro: text(400),
  /** own areas of a track in preparation; the club track uses the 11 Academy areas */
  areas: z
    .array(
      z.object({
        area: z.number().int().min(1).max(11),
        name: text(120),
        band: z.number().int().min(1).max(3),
        description: text(300),
      }),
    )
    .max(11)
    .optional(),
  /** short description of each Academy area on the Hub, keyed "1".."11" (club track) */
  teasers: z.record(z.string().regex(/^(?:[1-9]|1[01])$/), text(300)).optional(),
  hubRoles: z.array(hubRoleSchema).min(1).max(12),
});

export const roleCatalogSchema = z
  .object({
    source: text(300),
    /** Hub tracks with their role lenses (ADR 0011); optional for catalogs before v2 */
    tracks: z.array(trackSchema).max(4).optional(),
    baseRoles: z.array(baseRoleSchema).min(1).max(12),
    areas: z
      .array(
        z.object({
          area: z.number().int().min(1).max(11),
          status,
          note: text(500).optional(),
          roles: z.array(areaRoleSchema).min(1).max(12),
        }),
      )
      .max(11),
  })
  .superRefine((c, ctx) => {
    const base = new Set<string>();
    c.baseRoles.forEach((b, i) => {
      if (base.has(b.key))
        ctx.addIssue({
          code: "custom",
          path: ["baseRoles", i, "key"],
          message: `Duplicate base role ${b.key}`,
        });
      base.add(b.key);
    });
    const clubRoles = c.baseRoles.map((b) => b.clubRole).filter(Boolean);
    if (new Set(clubRoles).size !== clubRoles.length) {
      ctx.addIssue({
        code: "custom",
        path: ["baseRoles"],
        message: "A club role can belong to one base role only",
      });
    }
    (c.tracks ?? []).forEach((t, ti) => {
      const lens = new Set<string>();
      t.hubRoles.forEach((h, hi) => {
        if (lens.has(h.key))
          ctx.addIssue({
            code: "custom",
            path: ["tracks", ti, "hubRoles", hi, "key"],
            message: `Duplicate Hub role ${h.key}`,
          });
        lens.add(h.key);
        if (h.baseRole && !base.has(h.baseRole))
          ctx.addIssue({
            code: "custom",
            path: ["tracks", ti, "hubRoles", hi, "baseRole"],
            message: `Unknown base role ${h.baseRole}`,
          });
      });
    });
    const areas = new Set<number>();
    c.areas.forEach((a, i) => {
      if (areas.has(a.area))
        ctx.addIssue({
          code: "custom",
          path: ["areas", i, "area"],
          message: `Duplicate area ${a.area}`,
        });
      areas.add(a.area);
      const keys = new Set<string>();
      a.roles.forEach((r, j) => {
        if (keys.has(r.key))
          ctx.addIssue({
            code: "custom",
            path: ["areas", i, "roles", j, "key"],
            message: `Duplicate role ${r.key} in area ${a.area}`,
          });
        keys.add(r.key);
        r.baseRoles.forEach((b, k) => {
          if (!base.has(b))
            ctx.addIssue({
              code: "custom",
              path: ["areas", i, "roles", j, "baseRoles", k],
              message: `Unknown base role ${b}`,
            });
        });
      });
    });
  });

export type RoleCatalog = z.infer<typeof roleCatalogSchema>;
export type BaseRole = z.infer<typeof baseRoleSchema>;
export type AreaRole = z.infer<typeof areaRoleSchema>;
export type HubRole = z.infer<typeof hubRoleSchema>;
export type Track = z.infer<typeof trackSchema>;
