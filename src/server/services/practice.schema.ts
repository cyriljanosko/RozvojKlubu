import { z } from "zod";

/**
 * Practice (Prax) of an area: what each role does, the first step this week, a path of steps
 * with three options each (quick / usual / larger club), a backlog and links to next areas.
 * Source: content/prax/NN.json (converted from the area 3 and 4 design artifacts).
 */
const text = z.string().min(1);
const tag = z.enum(["all", "maly", "stredny+", "velky", "D", "Z", "DO", "S", "zd"]);
const link = z.object({ label: text, anchor: text }).strict();

const option = z
  .object({
    name: text,
    who: text,
    time: text,
    what: text,
    result: text,
    template: text.optional(),
    tag: tag.optional(),
    copyText: text.optional(),
    myAcademy: text.optional(),
    links: z.array(link).optional(),
  })
  .strict();

const step = z
  .object({
    id: text,
    label: text,
    title: text,
    why: text,
    links: z.array(link),
    options: z.array(option).min(1),
    branchB: z
      .object({ title: text, why: text, links: z.array(link), options: z.array(option).min(1) })
      .strict()
      .optional(),
    mentor: z
      .object({
        id: text,
        title: text,
        practice: z.array(text),
        template: text,
        modules: z.array(text),
      })
      .strict()
      .optional(),
  })
  .strict();

const role = z
  .object({
    id: z.string().regex(/^[a-z]{1,3}$/),
    label: text,
    parent: z.string().optional(),
    description: z.string(),
    who: z.string(),
    does: z.string(),
    gain: z.string(),
    responsibilities: z.array(text),
    notThis: z.array(text),
    time: text,
    withWhom: text,
    library: z.array(text),
    indicators: z.array(text),
    pathTitle: text,
    pathSubtitle: text,
    firstStep: z
      .object({
        title: text,
        who: text,
        time: text,
        result: text,
        template: text.optional(),
        myAcademy: text.optional(),
        tasks: z.array(z.object({ id: text, title: text, note: text.optional() }).strict()),
        aside: z.object({ title: text, text: text, note: text }).strict(),
      })
      .strict(),
    steps: z.array(step).min(1),
    backlog: z.array(z.object({ text: text, tag: tag }).strict()),
    next: z.array(
      z.object({ area: z.number().int().min(1).max(11), title: text, why: text }).strict(),
    ),
    myAcademyRole: z.string().optional(),
    mentorNumbers: z
      .array(z.object({ key: text, label: text, lowerIsBetter: z.boolean() }).strict())
      .optional(),
  })
  .strict();

export const practiceContentSchema = z
  .object({
    roles: z.array(role).min(1),
    templates: z.array(
      z.object({ key: text, title: text, description: text, text: text.optional() }).strict(),
    ),
    mentorModules: z.array(
      z
        .object({
          key: text,
          title: text,
          meta: z.array(text),
          text: z.string(),
          steps: z.array(text).optional(),
          points: z.array(text).optional(),
          how: z.unknown().optional(),
          lock: text.optional(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const roleIds = new Set<string>();
    for (const r of value.roles) {
      if (roleIds.has(r.id)) ctx.addIssue({ code: "custom", message: `Duplicate role ${r.id}` });
      roleIds.add(r.id);
    }
    const keys = new Set(value.templates.map((t) => t.key));
    const used = value.roles.flatMap((r) => [
      ...r.library,
      ...(r.firstStep.template ? [r.firstStep.template] : []),
      ...r.steps.flatMap((s) => [
        ...s.options.map((o) => o.template),
        ...(s.branchB?.options.map((o) => o.template) ?? []),
        s.mentor?.template,
      ]),
    ]);
    for (const k of used) {
      if (k && !keys.has(k)) ctx.addIssue({ code: "custom", message: `Unknown template ${k}` });
    }
  });

export type PracticeContent = z.infer<typeof practiceContentSchema>;

export const practiceFileSchema = z.object({
  area: z.number().int().min(1).max(11),
  source: z.string().nullable().optional(),
  validAsOf: z.iso.date().nullable(),
  reviewedAt: z.iso.date().nullable(),
  roles: z.unknown(),
  templates: z.unknown(),
  mentorModules: z.unknown(),
});
