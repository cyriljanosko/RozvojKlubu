# 0016 – Dizajn podľa SFZ Design System

- Stav: prijaté
- Dátum: 2026-10-26
- Rozhodol: Cyril Janoško
- Nahradené: 0018 (bod 7 – komponenty SFZ ako jediný základ UI, bez dočasného shadcn)

## Kontext

Aplikácie SFZ (ISSF, sportnet.online, ClubUp, futbalnet) majú spoločný dizajn systém
[`sfz-design-system`](https://github.com/Slovensky-futbalovy-zvaz/sfz-design-system): farby a logá podľa SFZ Design
Manual 2024-01, typografia SF Pro, svetlá aj tmavá téma, React komponenty. Rozvoj klubu doteraz používal neutrálne
farby shadcn/ui a písmo Geist. Cyril chce, aby projekt predvolene vychádzal z dizajn systému a pri jeho aktualizácii
sa dizajn zmenil aj tu – kvôli jednotnému vzhľadu aplikácií SFZ.

## Rozhodnutie

1. Závislosť `@slovensky-futbalovy-zvaz/design-system` s rozsahom `^1` z GitHub Packages (ADR 0003 dizajn systému);
   `.npmrc` číta token z premennej `NPM_GITHUB_TOKEN` (nie `GITHUB_TOKEN`, ktorý používa `gh`). Token (classic,
   len `read:packages`) je v GitHub Actions, v Dependabot secrets a vo Verceli.
2. **Aktualizácie:** Dependabot kontroluje dizajn systém denne a otvára samostatný PR; kontroly a náhľad na Verceli
   ukážu zmenu dizajnu, zlúčenie ostáva na pokyne Cyrila.
3. **Tokeny sú zdroj pravdy:** `tokens.css` sa načíta globálne, premenné tém aplikácie (shadcn `--background`,
   `--primary`, …) ukazujú na tokeny SFZ. V kóde žiadne natvrdo zapísané farby – výnimky sa postupne odstránia (DS-2).
4. **Písmo** podľa dizajn systému: systémové SF Pro (`--font-sans` z tokenov). Nahrádza pravidlo „písmo Geist
   z balíka `geist`“ v `CLAUDE.md`.
5. **Tmavá téma** podľa nastavenia zariadenia (`prefers-color-scheme`), ako ju definuje `tokens.css`.
6. **Logo SFZ** (variant D, horizontálny) v hlavičke; v tmavej téme biela verzia.
7. **Komponenty** dizajn systému sa preberajú postupne (DS-3); dovtedy ostávajú komponenty shadcn so štýlom z tokenov.

## Dôsledky

- Nová verzia dizajn systému zmení vzhľad aplikácie bez ručného prepisovania; zlom (major verzia) príde ako PR,
  ktorý treba skontrolovať.
- Build a `npm ci` potrebujú `NPM_GITHUB_TOKEN`; bez neho inštalácia zlyhá (lokálne `NPM_GITHUB_TOKEN=$(gh auth token)`).
- Balík sa inštaluje pod plným menom (bez aliasu `@sfz/design-system`), aby ho Dependabot spoľahlivo aktualizoval.
- Systémové písmo sa nesťahuje (žiadny webfont) – na Windows a Androide sa použije ich systémové písmo.

## Zamietnuté alternatívy a prečo

- **Inštalácia z gitu (`github:…#vX.Y.Z`) bez tokenu** – jednoduchšia prevádzka, ale každá aktualizácia by bola ručná
  zmena tagu; cieľom je automatické preberanie.
- **Kópia tokenov do repozitára** – rýchle, ale zmeny dizajn systému by sa nepreniesli.
- **npm alias `@sfz/design-system`** – kratšie importy, ale riziko, že Dependabot alias neaktualizuje.
