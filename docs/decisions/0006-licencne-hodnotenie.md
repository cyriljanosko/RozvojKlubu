# 0006 – Licenčné hodnotenie a Vizitka klubu

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško
- Nahradené: 0008 (bod 3, čiastočne – znovuotvorenie sezóny adminom)

## Kontext

Návrh „Vizitka klubu – licenčný systém“ (artifact, ostrá verzia pre pilot) počíta body a pásma v šiestich
oblastiach licenčného systému: 2 Tímy, 3 Hráči, 4 Tréneri zo Sportnetu (uzamknuté), 5 Infraštruktúra,
6 Aktivity, 7 Spolupráca vypĺňa klub. Koeficient sídla podľa počtu obyvateľov zadáva klub. Pravidlo celkovej
úrovne klubu nie je definované, body v oblastiach 6 a 7 sú predbežné. Artifact ukladal ručné údaje
do zdieľanej databázy artifactu; obsahuje jediný ukážkový záznam (Dukla 2026/2027).

Kompas klubu (F4) je sebahodnotenie v 11 oblastiach Akadémie; licenčný systém má vlastné číslovanie (9 oblastí).

## Rozhodnutie

1. **Vizitka klubu** má dve časti hodnotenia za sezónu – **Kompas** (11 oblastí) a **licenčné hodnotenie** –
   a zobrazuje ich vedľa seba. Hodnotí sa každá sezóna samostatne.
2. **Licenčné hodnotenie** sa ukladá ako Kompas: pracovná verzia na klub a sezónu s verziou a autorom zmeny;
   **uzavretie hodnotenia sezóny** uloží zmrazenú kópiu (história). Vizitka ukazuje posledné uzavreté
   hodnotenie oboch častí s dátumom.
3. **Kto upravuje:** vedenie klubu a mentor klubu (aj pri osobnej návšteve) a admin SFZ; tréner číta.
   Uzavrieť hodnotenie môže vedenie aj mentor. Upravovať sa dá každá sezóna zo snapshotu, kým nie je uzavretá.
4. **Pravidlá** sú v kóde ako jedna verzovaná sada „pilot 2026, predbežné“ (rovnaké čísla ako artifact);
   editor pravidiel pre admina neskôr. Uzavretá kópia nesie verziu pravidiel.
5. **Pohlavie trénera** (Sportnet ho nezverejňuje) sa odhaduje z priezviska (-ová/-á = trénerka),
   upravovateľ ho môže opraviť.
6. **Celková úroveň klubu** sa zatiaľ nepočíta. Neskôr: tri levely podľa **počtu hráčov** (malý, stredný,
   veľký) a v každom leveli 1–5 hviezd; hviezdy sa rátajú **samostatne** pre Kompas a pre licenčné hodnotenie.
7. Ukážkový záznam z artifactu sa nepreberá – ručné oblasti začínajú pri každom klube prázdne.

## Dôsledky

- Nové kolekcie (so súhlasom pred prvým zápisom): pracovné licenčné hodnotenie a uzavreté kópie, filter `clubId`.
- Oblasti 2–4 sa počítajú živo zo snapshotu `club_seasons`; po zmene snapshotu sa zmení aj pracovná verzia,
  uzavretá kópia zostáva.
- Mentor má pri licenčnom hodnotení širšie práva než pri Kompase (tam vidí len odoslané).

## Zamietnuté alternatívy a prečo

- **Mentor len číta** – mentor dopĺňa údaje pri osobnej návšteve klubu.
- **Bez histórie, len živý výpočet** – hodnotí sa každá sezóna a výsledok sa má dať porovnať v čase.
- **Prevziať záznam z artifactu** – bola to len ukážka.
- **Pravidlá hneď spravovateľné adminom** – pravidlá sú predbežné a menia sa zriedka; editor až po ustálení.
