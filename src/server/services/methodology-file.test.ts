import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseMethodologyFile } from "./methodology-file";

const sample = `---
area: 3
title: Tréneri — detail oblasti
source: https://example.com/a
validAsOf: 2026-09-30
reviewedAt: null
---

## Všeobecný popis {#popis}

Text **popisu**.

| a | b |
| --- | --- |
| 1 | 2 |

## Implementácia {#implementacia}

1. Krok
`;

describe("parseMethodologyFile", () => {
  it("parses front matter and sections", () => {
    const file = parseMethodologyFile(sample);
    expect(file).toMatchObject({
      area: 3,
      source: "https://example.com/a",
      validAsOf: "2026-09-30",
      reviewedAt: null,
    });
    expect(file.sections).toEqual([
      {
        key: "popis",
        order: 1,
        title: "Všeobecný popis",
        body: "Text **popisu**.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |",
      },
      { key: "implementacia", order: 2, title: "Implementácia", body: "1. Krok" },
    ]);
  });

  it("rejects malformed files", () => {
    expect(() => parseMethodologyFile("## X {#x}\n")).toThrow(/front matter/);
    expect(() => parseMethodologyFile("---\narea: 12\n---\n## X {#x}\n")).toThrow();
    expect(() => parseMethodologyFile("---\narea: 1\n---\nvolný text\n## X {#x}\n")).toThrow(
      /before the first section/,
    );
    expect(() => parseMethodologyFile("---\narea: 1\n---\n## X {#x}\n## Y {#x}\n")).toThrow(
      /Duplicate/,
    );
  });

  it("parses every file in content/metodika", () => {
    const dir = join(process.cwd(), "content/metodika");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(11);
    const areas = files.map((f) => parseMethodologyFile(readFileSync(join(dir, f), "utf8")));
    expect(areas.map((a) => a.area).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    for (const a of areas) {
      expect(a.sections.map((s) => s.key)).toContain("implementacia");
      expect(a.sections.map((s) => s.key)).not.toContain("sebahodnotenie");
    }
  });
});
