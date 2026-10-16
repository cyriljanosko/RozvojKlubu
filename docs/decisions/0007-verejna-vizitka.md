# 0007 – Vizitka klubu: verejná verzia a verzia pre roly

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško

## Kontext

ADR 0006 určil, že Vizitka klubu ukazuje za sezónu vedľa seba dve časti hodnotenia – Kompas a licenčné
hodnotenie – z posledného odoslaného, resp. uzavretého hodnotenia. Doteraz bol všetok obsah aplikácie len pre
prihlásených (rozhodnutie F3, 16. 10. 2026). Vizitka má ukázať, ako klub stojí, aj ľuďom mimo klubu.
Mapa produktu pri rodičovi uvádza, že nevidí „sebahodnotenie a slabiny“ klubu.

## Rozhodnutie

1. **Verejná Vizitka** `/vizitka/[clubId]` je prístupná **bez prihlásenia** – prvá verejná stránka aplikácie.
   Ukazuje profil klubu (názov, ObFZ, kraj, veľkosť podľa počtu hráčov, počet družstiev, hráčov a trénerov)
   a **hodnotenie každej oblasti** oboch častí (body a pásmo): Kompas 11 oblastí a licenčné hodnotenie
   6 oblastí. Len z odoslaného Kompasu a uzavretého licenčného hodnotenia, bez mien a bez jednotlivých odpovedí.
2. **Vizitka pre roly** `/klub/[clubId]/vizitka` (vedenie, tréner, mentor klubu, admin SFZ) ukazuje to isté
   a navyše dátumy, koeficient sídla, stav rozpracovaného hodnotenia a odkazy na detail (Kompas, licenčné hodnotenie).
3. Keď časť ešte nie je odoslaná / uzavretá, zobrazí sa „zatiaľ neodoslané / neuzavreté“, nie rozpracovaná verzia.
4. Sezóna sa vyberá v adrese (`?season=2026-2027`), predvolená je aktuálna sezóna.
5. Tlač / PDF a vizitka pre obec neskôr.

## Dôsledky

- Pravidlo „obsah len pre prihlásených“ už neplatí pre Vizitku; ostatný obsah (Metodika, Prax, Kompas) zostáva
  pre prihlásených.
- Verejne sú viditeľné body Kompasu po oblastiach, teda aj slabšie oblasti klubu (vedomé rozhodnutie Cyrila).
- Verejné čítanie ide cez službu bez používateľa; vracia len súhrnné čísla, filter `clubId` v každom dotaze.

## Zamietnuté alternatívy a prečo

- **Vizitka len pre prihlásených** – má ukázať klub aj verejnosti.
- **Verejne len licenčné hodnotenie alebo len celkové pásmo Kompasu** – Cyril chce verejne obe časti po oblastiach.
- **Zobrazovať rozpracované hodnotenie** – Vizitka má ukazovať len hotové výsledky.
