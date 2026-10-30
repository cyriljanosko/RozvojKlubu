import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { practiceContentSchema, practiceFileSchema } from "./practice.schema";

const dir = join(process.cwd(), "content/prax");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

describe("practice content files", () => {
  it("exist for areas 1, 3 and 4", () => {
    expect(files.map((f) => practiceFileSchema.parse(load(f)).area).sort()).toEqual([1, 3, 4]);
  });

  it.each(files)("%s matches the schema and references only known templates", (f) => {
    const { roles, templates, mentorModules } = load(f);
    const parsed = practiceContentSchema.parse({ roles, templates, mentorModules });
    // area 1 has four roles (decision 30. 10. 2026), areas 3 and 4 more
    expect(parsed.roles.length).toBeGreaterThanOrEqual(4);
    for (const r of parsed.roles) expect(r.steps.every((s) => s.options.length >= 1)).toBe(true);
  });

  it("rejects unknown fields and templates", () => {
    const { roles, templates, mentorModules } = load(files[0]);
    expect(() =>
      practiceContentSchema.parse({ roles, templates, mentorModules, extra: 1 }),
    ).toThrow();
    const broken = structuredClone(roles);
    broken[0].library = ["neexistuje"];
    expect(() => practiceContentSchema.parse({ roles: broken, templates, mentorModules })).toThrow(
      /Unknown template/,
    );
  });
});
