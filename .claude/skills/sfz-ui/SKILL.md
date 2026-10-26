---
name: sfz-ui
description: Use before designing, building or changing any screen or UI component in Rozvoj klubu – the app's UI is built only from the SFZ Design System (ADR 0018).
---

# UI podľa SFZ Design System

Pravidlá: ADR 0016 (tokeny, písmo, téma, logo) a ADR 0018 (komponenty SFZ ako jediný základ UI).
Plán prepisu a stav skupín obrazoviek: `docs/dizajn/plan-redesignu.md`, analýza: `docs/dizajn/analyza-obrazoviek.md`.

## Pred prácou

1. Prečítaj dokumentáciu komponentov, ktoré budeš používať:
   `node_modules/@slovensky-futbalovy-zvaz/design-system/components/docs/<Komponent>.md`
   (Alert, Avatar, Badge, Button, Calendar, Card, Checkbox, Chip, DataTable, Drawer, EmptyState, Icon,
   IconButton, Input, Modal, NavBar, Select, Skeleton, Stepper, TabBar, Table, Tabs, Textarea, Toast, Toggle).
2. Tokeny: `node_modules/@slovensky-futbalovy-zvaz/design-system/tokens/tokens.css`; značka a logá:
   `.../docs/brand-book.md`, `.../brand/`.
3. Over, že obrazovka má schválený návrh (Claude Design, plán redesignu). Bez neho obrazovku neprepisuj – opýtaj sa.

## Pri písaní

- Komponenty importuj z `@/components/sfz` (obaly pre Next.js: klientska hranica, `next/link`), nie priamo z balíka
  a nikdy z `@/components/ui`.
- Farby, medzery, zaoblenia a tiene len z tokenov (`var(--…)` alebo triedy Tailwind napojené na tokeny). Žiadne hex,
  `rgb()`, `oklch()` ani triedy palety typu `bg-blue-500`.
- Chýbajúci komponent sa skladá v `src/components/sfz` z tokenov a zapíše sa do analýzy ako návrh na doplnenie
  do dizajn systému.
- Texty cez next-intl, Server Components ako default, `"use client"` čo najnižšie (CLAUDE.md).

## Pred označením za hotové

- Overené na 375 px a na desktope, vo svetlej aj tmavej téme (`prefers-color-scheme`).
- Lint bez porušení pravidiel dizajnu; Definition of Done podľa `CLAUDE.md`.
