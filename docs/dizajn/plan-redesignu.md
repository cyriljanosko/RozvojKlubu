# Plán redesignu a napojenia na Sportnet

Stav: návrh na schválenie · Pripravil: Claude · Zadal: Cyril Janoško · 26. 10. 2026

## Zadanie (Cyril, 26. 10. 2026)

1. SFZ Design System je **predvolený a jediný** základ pre ďalší vývoj aj návrh obrazoviek. Nové obrazovky len
   v novom dizajne, **žiadne dočasné komponenty shadcn**.
2. Analýza všetkých obrazoviek stačí ako dokument v repozitári.
3. Návrh najprv pre prvú skupinu obrazoviek, po schválení všetky ostatné. **Nový dizajn sa nesmie rozbiť.**
4. Rozloženie a UX sa môžu prepracovať tam, kde to dáva zmysel.
5. Rozdeliť, čo je verejné a čo je za prihlásením podľa príslušnosti ku klubu a roly (klubový manažér, člen klubu,
   tréner, tímový manažér, vedúci tímu, …). Základné hodnotenia sú verejné; zbery dát a hodnotenia len po prihlásení,
   „len tak sa otestovať“ bez prihlásenia je vítané.
6. Navrhnúť hlavné menu a podmenu (routy podľa API alebo vlastný návrh).
7. Backend a administrácia: upratať číselníky – osoby, členovia klubov, roly v klube, typ osoby (tréner, tímový
   manažér), kluby (PO, PPO) – a napojiť ich na číselníky Sportnetu. Dokončiť prihlásenie cez Sportnet (profily osôb
   s rolami).
8. **Poradie: najprv redesign** (s ohľadom na body 5–7), **potom integrácia na Sportnet**.

## Etapy

Každá etapa = samostatná vetva a PR (merge commit, ADR 0017), zlučuje Cyril. Etapa sa začína až po schválení
výstupu predchádzajúcej.

| Etapa | Obsah                                                                                                                                                                                                        | Výstup                              | Schvaľuje |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------- |
| R0    | Dizajn systém ako jediný základ UI: ADR 0018, pravidlo v `CLAUDE.md`, projektový skill pre prácu na UI                                                                                                       | PR s dokumentáciou                  | Cyril     |
| R1    | Analýza 30 obrazoviek, model prístupov (verejné / prihlásený / klub podľa roly), informačná architektúra (hlavné menu, podmenu, routy), medzery dizajn systému                                               | `docs/dizajn/analyza-obrazoviek.md` | Cyril     |
| R2a   | Návrh skupiny 1 (verejná časť + prehľad klubu) v Claude Design nad artifactom SFZ Design System – mobil 375 px aj desktop                                                                                    | Design artifact                     | Cyril     |
| R2b   | Návrh ostatných skupín (klub, mentor, Moja Akadémia, analýza, administrácia) podľa vzorov schválených v R2a                                                                                                  | ten istý artifact, ďalšie plátna    | Cyril     |
| R3    | Technický základ: vrstva komponentov `src/components/sfz` (obaly komponentov dizajn systému pre Next.js), nová hlavička a navigácia (NavBar, TabBar, podmenu), ochrana pred rozbitím dizajnu (lint pravidlá) | PR                                  | Cyril     |
| R4…   | Prepis obrazoviek po skupinách podľa schválených návrhov, jedna skupina = jeden PR; po poslednej skupine odstránenie shadcn (`src/components/ui`) – mazanie len so súhlasom                                  | PR na skupinu                       | Cyril     |
| S1    | Prihlásenie cez Sportnet dokončiť: registrácia OAuth klienta, overenie claimov, profil osoby                                                                                                                 | PR + ADR                            | Cyril     |
| S2    | Roly a príslušnosť ku klubu zo Sportnetu (štatutár, manažér, tréner, tímový manažér, vedúci tímu, hráč/člen) → väzby `club_memberships`; rozšírenie `CLUB_ROLES` – **zmena schémy, vyžaduje súhlas**         | ADR + PR                            | Cyril     |
| S3    | Číselníky a administrácia: osoby, členstvá, roly v klube, typ osoby, kluby (PO, PPO) zo Sportnetu; upratanie `/admin`                                                                                        | ADR + PR                            | Cyril     |

## Ako zabezpečiť, že sa nový dizajn nerozbije

- **Lint pravidlá** (bez novej závislosti, cez ESLint `no-restricted-imports` a `no-restricted-syntax`): zákaz importu
  `@/components/ui/*` v prepísaných obrazovkách, zákaz farieb mimo tokenov (hex, `rgb()`, triedy palety Tailwind
  typu `bg-blue-500`). Pravidlá sa zapínajú postupne pre prepísané skupiny, po R4 pre celý `src`.
- **Kontrolný zoznam v PR**: 375 px a desktop, svetlá aj tmavá téma, len komponenty `src/components/sfz`.
- **Voliteľne** vizuálne regresné testy (Playwright screenshoty) – nová závislosť, len so súhlasom Cyrila.
- Aktualizácie dizajn systému chodia cez Dependabot ako PR – náhľad na Verceli ukáže zmenu pred zlúčením (ADR 0016).

## Riziká a otvorené technické veci

- **Komponenty dizajn systému nemajú direktívu `"use client"`**, hoci časť z nich používa hooky (Tabs, Table, Toast,
  Modal, …). V Next.js ich treba obaliť klientskou hranicou (`src/components/sfz`), alebo direktívy doplniť priamo
  v dizajn systéme. Rieši R3.
- **NavBar a TabBar používajú `<a href>`**, nie `next/link` – každé kliknutie by načítalo celú stránku. Riešenie:
  obal s `next/link` v aplikácii, alebo podpora vlastného komponentu odkazu v dizajn systéme (návrh do repozitára
  sfz-design-system).
- **Medzery dizajn systému** (zatiaľ zistené): akordeón (zbalené sekcie Metodiky, ADR 0011), drobčeková navigácia,
  ukazovateľ postupu/skóre, grafy, mapa SR, sieťový graf. Riešenie: skladať len z tokenov v `src/components/sfz`
  a navrhnúť doplnenie do dizajn systému. Detail v R1.
- **`components.css`** dizajn systému sa zatiaľ nenačítava (len `tokens.css`) – doplní sa v R3.
- **Sportnet**: MCP so Sportnet dokumentáciou nie je v tejto session pripojený; pre S1–S3 ho treba pripojiť.
  Redesign (R) navrhne obrazovky už s cieľovými rolami, implementácia rolí príde v S2.
