# 0018 – Komponenty SFZ Design System ako jediný základ UI

- Stav: prijaté
- Dátum: 2026-10-26
- Rozhodol: Cyril Janoško
- Nahrádza: 0016 (bod 7 – postupné preberanie komponentov, dovtedy shadcn)

## Kontext

ADR 0016 napojil aplikáciu na tokeny SFZ Design System a komponenty mal preberať postupne (DS-3); dovtedy ostávali
komponenty shadcn so štýlom z tokenov. Cyril chce aplikáciu prepracovať celú: nové obrazovky vyhradne v novom
dizajne, s prepracovaným rozložením a UX tam, kde to dáva zmysel, a bez dočasného miešania so shadcn. Návrhy
obrazoviek vznikajú v Claude Design nad artifactom SFZ Design System.

## Rozhodnutie

1. **Jediný základ UI** sú komponenty a tokeny `@slovensky-futbalovy-zvaz/design-system`. Nová alebo prepísaná
   obrazovka nepoužíva komponenty shadcn (`src/components/ui`) ani vlastné štýly mimo tokenov.
2. Komponenty dizajn systému sa v aplikácii používajú cez **vrstvu `src/components/sfz`**: obaly pre Next.js
   (klientska hranica, `next/link` v navigácii). Čo dizajn systém nemá (napr. akordeón, grafy, mapa), sa skladá
   v tejto vrstve len z tokenov a navrhne sa na doplnenie do dizajn systému.
3. **Postup:** návrh skupiny obrazoviek → schválenie Cyrilom → prepis skupiny v jednom PR (plán v
   `docs/dizajn/plan-redesignu.md`). Shadcn sa odstráni, keď ho žiadna obrazovka nepoužíva.
4. **Ochrana dizajnu:** lint pravidlá zakážu import `src/components/ui` a farby mimo tokenov v prepísaných
   obrazovkách; po dokončení prepisu v celom `src`.

## Dôsledky

- Kým prepis nie je hotový, aplikácia má dve vizuálne vrstvy (prepísané a neprepísané skupiny) – preto sa prepisuje
  po celých skupinách a hlavička s navigáciou ide ako prvá.
- Úprava komponentu sa robí v dizajn systéme (repozitár sfz-design-system), nie lokálnym prepísaním štýlu.
- Pravidlo „shadcn/ui“ v stacku (`CLAUDE.md`) platí len pre neprepísané obrazovky do konca prepisu.

## Zamietnuté alternatívy a prečo

- **Postupná výmena komponentov po jednom (pôvodný DS-3)** – obrazovky by dlho miešali dva dizajny a rozloženie by sa
  neprepracovalo.
- **Ponechať shadcn so štýlom z tokenov** – vzhľad by sa líšil od ostatných aplikácií SFZ a zmeny komponentov
  v dizajn systéme by sa neprenášali.
- **Kopírovať komponenty dizajn systému do repozitára** – stratili by sa aktualizácie cez Dependabot (ADR 0016).
