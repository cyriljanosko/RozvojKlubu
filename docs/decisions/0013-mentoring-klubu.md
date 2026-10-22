# 0013 – Mentoring klubu ako sezónny cyklus

- Stav: prijaté
- Dátum: 2026-10-22
- Rozhodol: Cyril Janoško

## Kontext

Návštevy mentora (MV, 21. 10. 2026) zaznamenávajú jednotlivé stretnutia: zhrnutie, zistenia pri
oblastiach a dohodnuté kroky. Cyril poslal vzor mentoringu študenta školenia trénerov UEFA EYA
(„Mentoring EYA“, Excel). Ten je **cyklus**: témy a úvodné sebahodnotenie, zameranie rozvoja od
mentora, stretnutia (téma, dátum a miesto, forma, úloha vopred, silné a slabé stránky, odporúčania,
hodnotenie, úloha po), záverečné sebahodnotenie a ďalší plán rozvoja. Klub potrebuje rovnaký rámec
na sezónu.

## Rozhodnutie

1. **Mentoring klubu = cyklus sezóny** v štyroch častiach: ① úvodné sebahodnotenie klubu
   (silné, slabé, čo chceme zlepšiť, čo čakáme od mentora) – píše **len vedenie**; ② zameranie
   rozvoja od mentora (silné, slabé, odporúčania, charakteristika klubu, 1–3 prioritné oblasti);
   ③ stretnutia = návštevy mentora; ④ záver – klub (hodnotenie krokov, pripomienky k mentoringu,
   výstupné sebahodnotenie) a mentor (záverečné hodnotenie, plán na ďalšiu sezónu).
2. Nová kolekcia **`club_mentoring`** (súhlas 22. 10. 2026): jeden dokument na klub a sezónu
   (unikátny index `clubId + season`), časti ①, ② a ④ s verziou; každá časť sa ukladá celá.
   Zapisuje sa len aktuálna sezóna, minulé sú na čítanie.
3. **Pripomienky klubu k mentoringu** vidí mentor a admin SFZ (a vedenie, ktoré ich písalo),
   tréner nie.
4. **Návštevy** dostávajú nové polia (súhlas 22. 10. 2026): téma (0–3 oblasti), stav
   **naplánovaná** (klub ju vidí s dátumom, témou a úlohou vopred), **úloha vopred** (klub ju
   odškrtne, mentor ohodnotí), **hodnotenie v štyroch poliach** (silné, slabé, odporúčania,
   celkové hodnotenie) **namiesto zhrnutia** a **hodnotenie dohodnutých krokov**
   (splnené / čiastočne / nesplnené). Zhrnutie ostáva pri starších návštevách.
5. Bez migrácie: staré návštevy dostanú pri čítaní prázdne nové polia (`mentor-visit.store.ts`).

## Dôsledky

- Fázy: MC-a model a API, MC-b rozšírená návšteva, MC-c stránka Mentoring klubu (úvod, zameranie,
  záver, tlač), MC-d úlohy, nástenka, Vizitka a prehľady.
- Kým MC-b neupraví formulár návštevy, starý formulár nové polia nepozná – naplánovanú návštevu
  zatiaľ vytvorí len API.
- Mentoring trénera (EYA) sa dá neskôr postaviť na rovnakom modeli – zatiaľ sa neplánuje.

## Zamietnuté alternatívy a prečo

- **Len rozšíriť návštevy** – chýbal by začiatok a koniec cyklu (Cyril zvolil celý cyklus).
- **Úvod, zameranie a záver ako polia v pláne sezóny (`club_plans`)** – plán je o cieľoch a má
  verejný výpis na Vizitke; mentoring obsahuje neverejné hodnotenia a pripomienky.
- **Voľné zhrnutie popri štyroch poliach** – Cyril zvolil štyri polia namiesto zhrnutia, aby sa
  návštevy dali porovnávať.
