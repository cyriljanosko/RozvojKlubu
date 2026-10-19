import { z } from "zod";

/**
 * Parses a methodology file (content/metodika/NN.md):
 *   front matter (area, title, source, validAsOf, reviewedAt) + "## Title {#key}" sections.
 * Pure – no file system access.
 */
export interface MethodologyFile {
  area: number;
  source: string | null;
  validAsOf: string | null;
  reviewedAt: string | null;
  sections: { key: string; order: number; title: string; body: string }[];
}

const dateOrNull = z
  .string()
  .transform((v) => (v === "null" || v === "" ? null : v))
  .pipe(z.iso.date().nullable());

const frontSchema = z.object({
  area: z.coerce.number().int().min(1).max(11),
  source: z.string().optional(),
  validAsOf: dateOrNull.optional().default(null),
  reviewedAt: dateOrNull.optional().default(null),
});

const HEADING = /^## (.+?) \{#([a-z0-9-]+)\}\s*$/;

export function parseMethodologyFile(text: string): MethodologyFile {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error("Missing front matter");
  const front = Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => {
        const i = line.indexOf(":");
        return i < 0 ? [line.trim(), ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
      .filter(([key]) => key),
  );
  const meta = frontSchema.parse(front);

  const sections: MethodologyFile["sections"] = [];
  let current: { key: string; title: string; lines: string[] } | null = null;
  const push = () => {
    if (!current) return;
    sections.push({
      key: current.key,
      order: sections.length + 1,
      title: current.title,
      body: current.lines.join("\n").trim(),
    });
  };
  for (const line of text.slice(match[0].length).split("\n")) {
    const h = HEADING.exec(line);
    if (h) {
      push();
      current = { title: h[1], key: h[2], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      throw new Error("Text before the first section");
    }
  }
  push();
  if (sections.length === 0) throw new Error("No sections");
  if (new Set(sections.map((s) => s.key)).size !== sections.length) {
    throw new Error("Duplicate section key");
  }
  return {
    area: meta.area,
    source: meta.source ?? null,
    validAsOf: meta.validAsOf,
    reviewedAt: meta.reviewedAt,
    sections,
  };
}
