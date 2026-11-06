# 0029 – Nočná synchronizácia klubov zo Sportnetu (Vercel Cron)

- Stav: **prijaté** – 6. 11. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR
- Dátum: 2026-11-06
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0021 (bez cronu pre roly), 0026 (klub pri prihlásení), 0028 (kluby zo Sportnetu)

## Kontext

Import klubov (ADR 0028) má dva kroky, ktoré spúšťa admin SFZ ručne: zoznam klubov a podrobnosti
(zväz, región, IČO) po dávkach. Klub založený pri prihlásení klubového manažéra (ADR 0026) aj nový klub
v Sportnete ostanú bez zväzu a IČO, kým niekto import nespustí znova. Zmena zväzu, názvu alebo stavu
klubu v Sportnete sa do aplikácie nedostane sama.

Jeden klub potrebuje na podrobnosti dve volania CoreApi za sebou (B8). 150 klubov trvalo 27 s, takže
všetkých 1 558 klubov sa do limitu funkcie 300 s nezmestí.

ADR 0021 cron pre roly zamietol: roly sú čerstvé z prihlásenia. Kluby sú iný prípad – číta ich aj
návštevník bez prihlásenia (Kluby, mapa, vyhľadávanie).

## Rozhodnutie

1. **Vercel Cron denne o 2:00 UTC** volá `GET /api/v1/cron/sportnet-clubs` (`vercel.json`).
2. **Jeden beh:** zoznam všetkých klubov (založí nové, obnoví názov, logo a stav) a podrobnosti
   najviac 600 klubov – najprv kluby bez podrobností (najprv používané v aplikácii), potom kluby
   s najstaršími podrobnosťami. Každý klub sa obnoví zhruba raz za 3 dni. Podrobnosti sa prestanú čítať
   po 240 s, aby beh skončil v limite.
3. **Zapisuje priamo, bez dry-runu.** Ručné cesty admina ostávajú s dry-runom predvolene.
4. **Ochrana:** route prijme len hlavičku `Authorization: Bearer $CRON_SECRET`, ktorú posiela Vercel.
   Bez nastaveného `CRON_SECRET` odmietne každé volanie (401). Do logu ide len súhrn počtov.

## Dôsledky

- `CRON_SECRET` treba nastaviť vo Verceli (Production) – kým nie je, cron sa volá, ale nič nespraví.
- Klub, ktorý v Sportnete zmení zväz, bude mať v aplikácii nový zväz najneskôr o ~3 dni.
- Produkcia a Preview zdieľajú `rozvojklubu_dev`; cron beží len na produkcii (Vercel volá cron len
  pre produkčné nasadenie), zápis je ten istý ako pri ručnom importe.
- Chybný klub (Sportnet vráti chybu) sa preskočí a skúsi sa pri ďalšom behu.

## Zamietnuté alternatívy a prečo

- **Raz týždenne** – nový klub z prihlásenia by čakal na zväz a IČO až týždeň (Ján, 6. 11.).
- **Len nové kluby bez podrobností** – zmena zväzu alebo IČO existujúceho klubu by sa nikdy neprejavila
  bez ručného spustenia.
- **Všetky kluby v jednom behu** – nezmestí sa do 300 s; rozdelenie na viac cronov za noc pridá
  koordináciu bez úžitku.
- **`vercel.ts`** – potrebuje novú závislosť `@vercel/config`; na jeden cron stačí `vercel.json`.
