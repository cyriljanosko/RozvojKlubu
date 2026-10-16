# 0010 – Roly v oblastiach ako spravovaný obsah

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško
- Nahradené: 0011 (bod 3 – zoznam základných rolí, čiastočne)

## Kontext

ADR 0004 zaviedol roly v klube ako väzbu osoba – klub – rola – sezóna s tromi rolami (vedenie, tréner, mentor).
Návrh „Roly v 11 oblastiach“ (verzia 1, 11. 10. 2026, na hodnotenie) počíta so **6 základnými rolami**
(Manažér a výbor, Tréner a trénerka, Rodič, Tímový hráč klubu, Mladí v klube 15–25 – otvorená otázka,
Mentor zväzu) a so **60 rolami v oblastiach**, z ktorých každá patrí k jednej alebo viacerým základným rolám.
Prax oblastí 3 a 4 (schválená 9. a 8. 10.) už má vlastné roly. Návrh sa ešte hodnotí a bude sa meniť.

## Rozhodnutie

1. Základné roly aj roly v oblastiach sú **spravovaný obsah** – jeden validovaný dokument „katalóg rolí“
   (`content/roly.json`, kolekcia `role_catalog`) s verziou, históriou zmien a vrátením; upravuje admin SFZ.
2. Každá rola v oblasti má názov, „kto to je“, „čo bude robiť v praxi“, priradenie k základným rolám,
   voliteľne väzbu na rolu v Praxi a stav **schválené / návrh**. Oblasti 3 a 4 sú schválené, ostatné návrh.
3. Roly v klube (ADR 0004) zostávajú väzbou na základnú rolu; v pilote sa prideľujú **Manažér a výbor**
   (doterajšie „vedenie“), **Tréner a trénerka** a **Mentor zväzu**. Rodič a tímový hráč klubu prídu
   pozvánkou od klubu (F7), mladí v klube až po vyriešení súhlasu zákonného zástupcu.
4. Človek si v Moja Akadémia **sám označí svoje roly v oblastiach** (nepovinne, F6b); bez označenia vidí
   všetky roly svojej základnej roly.
5. Rola „vedenie“ sa v texte premenuje na **„Manažér a výbor“**; kľúč `management` v dátach zostáva.

## Dôsledky

- Výsledok hodnotenia návrhu sa doplní úpravou obsahu, nie programovaním.
- Nová kolekcia `role_catalog` (súhlas pred prvým zápisom).
- Prax ďalších oblastí sa bude písať pre roly z katalógu.

## Zamietnuté alternatívy a prečo

- **Roly natvrdo v kóde** – návrh sa ešte mení, každá zmena by potrebovala programátora.
- **Čakať na výsledok hodnotenia** – F6 by stála; katalóg sa dá upraviť kedykoľvek.
- **Všetkých 6 základných rolí hneď** – rodič a tímový hráč potrebujú pozvánky, mladí súhlas zákonného zástupcu.
