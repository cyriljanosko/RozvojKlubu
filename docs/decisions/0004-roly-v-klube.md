# 0004 – Roly v klube ako väzba osoba – klub – rola – sezóna

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško

## Kontext

Kód z 15. 10. 2026 má jednu globálnu rolu na používateľa (`user.role`: `admin_sfz`, `obfz`, `club_manager`,
`mentor`, `volunteer`, `public`). Návrhy produktu (mapa produktu, `docs/produkt/mapa-produktu.md`) počítajú
s inými rolami a s tým, že jeden človek má v klube viac rolí naraz (napr. tréner U13 a rodič hráča U9),
prípadne roly vo viacerých kluboch, a že rola rodiča alebo tímového hráča platí len jednu sezónu.
Mentor nepatrí klubu, ale kohorte oblastného zväzu. Čo kto vidí, závisí od roly v konkrétnom klube
(Moja Akadémia: „čo táto rola vidí“) a tenant je klub (ADR 0003).

## Rozhodnutie

- Roly v klube sa ukladajú ako **samostatné väzby** (členstvá): osoba – rozsah (klub alebo zväz/kohorta) – rola –
  sezóna platnosti, prípadne zúžené na kategórie (napr. tréner U13).
- Roly z návrhov: vedenie (manažér, výbor, štatutár), tréner, mentor, rodič, hráč, tímový hráč klubu, rozhodca, SFZ.
  Pilot Stupňa II pokrýva vedenie, trénera a mentora.
- Funkcionárov a trénerov odvodzujeme zo Sportnetu (zatiaľ zo snapshotu), rodiča a tímového hráča pridáva klub
  pozvánkou na jednu sezónu.
- `user.role` zostáva len pre **globálne oprávnenia** aplikácie (admin SFZ, správa obsahu); ostatné hodnoty
  sa prestanú používať pri implementácii väzieb.
- Oprávnenia sa vyhodnocujú v service vrstve z väzby pre daný `clubId`; každý dotaz na klubové dáta má filter
  `clubId` (ADR 0003).

## Dôsledky

- Nová kolekcia pre väzby (názov a schéma sa schvália pri implementácii – zmena schémy vyžaduje súhlas).
- Prepínanie aktívnej roly a klubu v UI (Moja Akadémia: „Moje roly v klube“).
- Úprava `roles.ts`, `requireRole` a testov; migrácia existujúcich hodnôt `user.role` (zatiaľ len testovacie účty).

## Zamietnuté alternatívy a prečo

- **Rozšíriť `user.role` o nové hodnoty** – nezvládne viac rolí naraz, viac klubov ani platnosť na sezónu.
- **Admin/organization plugin Better Auth** – organizácie by duplikovali kluby zo Sportnetu a rola by bola
  pod kontrolou knižnice; tenant a sezónnu platnosť aj tak treba riešiť vlastne.
