# 0019 – Ochrana dizajnu: lint pravidlá a vizuálne regresné testy

- Stav: prijaté
- Dátum: 2026-10-26
- Rozhodol: Cyril Janoško

## Kontext

Redesign stavia UI výhradne na SFZ Design System (ADR 0018). Zadanie znie, že nový dizajn sa nesmie rozbiť –
ani návratom k shadcn alebo k farbám zapísaným natvrdo, ani nechcenou zmenou vzhľadu (napr. pri aktualizácii
dizajn systému cez Dependabot). Kontrola očami pri každom PR to nezaručí. CI na GitHube nemá databázu, takže
skutočné obrazovky sa v ňom bez dát nevykreslia.

## Rozhodnutie

1. **Lint pravidlá** (`eslint.config.mjs`, `REDESIGNED_FILES`): v prepísaných súboroch zakázaný import
   `@/components/ui`, `lucide-react` a priamy import balíka dizajn systému (len cez `@/components/sfz`), farby
   mimo tokenov (hex, `rgb()`, `hsl()`, `oklch()`, triedy palety Tailwindu) a farby programov (`--gold`,
   `--program-*`). Každá prepísaná skupina obrazoviek pridá svoje priečinky do zoznamu.
2. **Vizuálne regresné testy Playwright** (`e2e/`, `npm run test:e2e`) v CI po builde: screenshoty ukážkovej
   stránky `/dev/ukazky` (vrstva SFZ, rám aplikácie, pásma, formulárové prvky) pri 375 px a 1280 px, vo svetlej
   aj tmavej téme. Stránka nepotrebuje databázu a existuje len s `ENABLE_DEV_PAGES=1` (v produkcii 404).
3. **Základné screenshoty sú z Linuxu** (rovnaké prostredie ako CI), uložené v `e2e/__screenshots__`;
   screenshoty z macOS sú len lokálne a necommitujú sa. Postup aktualizácie je v `RUNBOOK.md`.
4. Závislosť `@playwright/test` (dev) a prehliadač Chromium v CI – schválené Cyrilom 26. 10. 2026.

## Dôsledky

- PR, ktorý zmení vzhľad ukážok, v CI zlyhá a priloží porovnanie (artefakt `playwright-report`); zámernú zmenu
  treba potvrdiť novými základnými screenshotmi.
- Aktualizácia dizajn systému (Dependabot) ukáže zmenu vzhľadu ako zlyhaný test – rozhodnutie ostáva na Cyrilovi.
- CI je dlhšie o inštaláciu Chromia a testy (približne 1 – 2 minúty).
- Skutočné obrazovky s dátami pribudnú do testov v R4 spolu s testovacími dátami.

## Zamietnuté alternatívy a prečo

- **Screenshoty skutočných obrazoviek na Vercel preview** – zdieľaná databáza sa mení, testy by padali bez
  zmeny dizajnu.
- **Len lint, bez screenshotov** – nezachytí zmenu vzhľadu komponentov ani rozloženia.
- **Základné screenshoty z macOS** – písmo a vykresľovanie sa líšia od Linuxu v CI, testy by v CI vždy padali.
