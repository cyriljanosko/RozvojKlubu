import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/** Lint rules that keep redesigned screens on the SFZ Design System (eslint.config.mjs, ADR 0018). */
const eslint = new ESLint({ cwd: process.cwd() });

async function guardMessages(code: string, filePath = "src/app/viac/example.tsx") {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) =>
    ["no-restricted-imports", "no-restricted-syntax"].includes(m.ruleId ?? ""),
  );
}

describe("design guard", () => {
  it("rejects shadcn, lucide and the raw design-system package in redesigned files", async () => {
    const messages = await guardMessages(
      [
        'import { Button } from "@/components/ui/button";',
        'import { X } from "lucide-react";',
        'import { Card } from "@slovensky-futbalovy-zvaz/design-system";',
        "export const a = [Button, X, Card];",
      ].join("\n"),
    );
    expect(messages).toHaveLength(3);
  });

  it("rejects palette classes, raw colours and programme colours", async () => {
    const messages = await guardMessages(
      [
        'export const a = "flex bg-blue-600 p-4";',
        'export const b = "dark:text-emerald-400";',
        "export const c = `border-l-amber-600 ${a}`;",
        'export const d = { color: "#2563eb" };',
        'export const e = "rgb(0, 0, 0)";',
        'export const f = "var(--program-green)";',
      ].join("\n"),
    );
    expect(messages).toHaveLength(6);
  });

  it("allows tokens, layout utilities and the design-system layer", async () => {
    const messages = await guardMessages(
      [
        'import { Button } from "@/components/sfz";',
        'export const a = "flex gap-3 bg-(--surface-raised) text-(--ink) md:pb-0";',
        'export const b = "sfz-btn sfz-btn--primary";',
        'export const c = "#rebricek";',
        "export const d = Button;",
      ].join("\n"),
    );
    expect(messages).toEqual([]);
  });

  it("does not apply to screens that are not redesigned yet", async () => {
    const messages = await guardMessages(
      'import { Button } from "@/components/ui/button";\nexport const a = ["bg-blue-600", Button];',
      "src/app/oblasti/example.tsx",
    );
    expect(messages).toEqual([]);
  });
});
