import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Files already rebuilt on the SFZ Design System (ADR 0018). Each redesigned group of screens
 * (R4) adds its folders here, so the new design cannot slip back to shadcn or raw colours.
 */
export const REDESIGNED_FILES = [
  "src/components/sfz/**",
  "src/components/app-frame/**",
  "src/app/layout.tsx",
  "src/app/viac/**",
  "src/app/dev/**",
  "src/app/admin/layout.tsx",
  "src/app/klub/[[]clubId]/layout.tsx",
  // R4 G1a – Akadémia (Hub), Oblasti, Prihlásenie
  "src/app/page.tsx",
  "src/app/oblasti/page.tsx",
  "src/app/prihlasenie/**",
  "src/components/areas/**",
  // R4 G1b – detail oblasti (Metodika, Prax); pin-button waits for the DS "star" icon
  "src/app/oblasti/[[]area]/**",
  "src/components/content/coach-education.tsx",
  "src/components/content/markdown.tsx",
  "src/components/content/practice-progress.tsx",
  "src/components/content/practice-view.tsx",
  // R4 G1c – Kompas na vyskúšanie; the form is shared with the club Kompas (page itself in G2)
  "src/app/kompas/**",
  "src/app/klub/[[]clubId]/kompas/kompas-form.tsx",
  // R4 G2b – Kompas klubu a odoslaný Kompas
  "src/app/klub/[[]clubId]/kompas/**",
  "src/components/content/copy-line.tsx",
  // R4 G1d – Kluby a vizitka (verejná aj klubová); milestones.tsx waits for DS icons
  "src/app/vizitka/**",
  "src/components/vizitka/public-plan.tsx",
  "src/components/vizitka/stars.tsx",
  "src/components/vizitka/vizitka-view.tsx",
  "src/components/vizitka/vizitky-explorer.tsx",
  // R4 G2a – prehľad klubu a klubová vizitka
  "src/app/klub/[[]clubId]/page.tsx",
  "src/app/klub/[[]clubId]/vizitka/**",
  "src/components/academy/**",
  // R4 G2c – plán a licenčné hodnotenie
  "src/app/klub/[[]clubId]/plan/**",
  "src/app/klub/[[]clubId]/licencne-hodnotenie/**",
  // R4 G2d – mentoring a návštevy
  "src/app/klub/[[]clubId]/mentoring/**",
  "src/app/klub/[[]clubId]/navstevy/**",
];

/** Tailwind palette colours – the design must use tokens (bg-(--surface), text-(--ink) …) instead. */
// esquery regexes cannot contain "/", so opacity suffixes (bg-blue-600/50) are covered by the word boundary
const PALETTE =
  "\\b(bg|text|border(-[trblxyse])?|fill|stroke|ring|outline|decoration|divide|from|via|to|accent|caret|shadow)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black)(-[0-9]+)?\\b";
const RAW_COLOUR =
  "#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?\\b|\\brgba?\\(|\\bhsla?\\(|\\boklch\\(";
const PROGRAMME = "--gold|--program-";

const colourMessage =
  "Farby len z tokenov SFZ Design System (ADR 0016, 0018) – žiadne hex, rgb(), oklch(), triedy palety Tailwindu ani farby programov.";

const designGuard = {
  files: REDESIGNED_FILES,
  ignores: ["**/*.test.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@slovensky-futbalovy-zvaz/design-system",
            message: "Komponenty dizajn systému importuj z @/components/sfz (ADR 0018).",
          },
          {
            name: "lucide-react",
            message:
              "Ikony z dizajn systému (Icon z @/components/sfz); chýbajúce doplniť do sfz-design-system.",
          },
        ],
        patterns: [
          {
            group: ["@/components/ui", "@/components/ui/*"],
            message: "Prepísané obrazovky nepoužívajú shadcn – len @/components/sfz (ADR 0018).",
          },
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      { selector: `Literal[value=/${PALETTE}/]`, message: colourMessage },
      { selector: `TemplateElement[value.raw=/${PALETTE}/]`, message: colourMessage },
      { selector: `Literal[value=/${RAW_COLOUR}|${PROGRAMME}/]`, message: colourMessage },
      {
        selector: `TemplateElement[value.raw=/${RAW_COLOUR}|${PROGRAMME}/]`,
        message: colourMessage,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  designGuard,
  {
    // The one place that may import the design system package directly
    files: ["src/components/sfz/ds.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
