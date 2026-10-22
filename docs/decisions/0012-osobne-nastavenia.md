# 0012 – Osobné nastavenia používateľa (nástenka a obľúbené)

- Stav: prijaté
- Dátum: 2026-10-22
- Rozhodol: Cyril Janoško

## Kontext

Moja Akadémia sa má stať nástenkou: dlaždice sa dajú posúvať a skryť a používateľ si pripína obľúbené
stránky (oblasť, sekcia Metodiky, krok alebo vzor Praxe, Vizitka, plán a návštevy klubu).
Rozloženie analýzy (DA-c) je zatiaľ len v prehliadači. Pri nástenke Cyril chce, aby nastavenia
platili na telefóne aj na počítači. ADR 0003 hovorí, že každý dotaz na dáta klubu má filter `clubId`.
Nastavenia však nie sú dáta klubu, patria jednému človeku.

## Rozhodnutie

1. Nová kolekcia `user_preferences` (súhlas 22. 10. 2026): **jeden dokument na používateľa**
   (`userId`, unikátny index), v ňom poradie a skryté dlaždice nástenky a zoznam obľúbených
   (najviac 30), s verziou (optimistické ukladanie ako pri pláne klubu).
2. Je to **osobné nastavenie, nie dáta klubu** – výnimka z ADR 0003: dotaz ide len cez `userId`
   prihláseného používateľa, nikdy nie cez parameter z požiadavky. Iný používateľ (ani admin) ho nečíta.
3. Obľúbená položka je len **odkaz** (druh, vnútorná cesta, popis v čase pripnutia). Prístup k stránke
   overuje stránka sama, takže pripnutie nič nesprístupní. Povolené sú len vnútorné cesty (`/…`), nie
   externé odkazy.
4. Pripnutie a odopnutie nepotrebujú verziu: služba vezme najnovší stav a pri súbežnej zmene (iná karta)
   to skúsi znova. Uloženie rozloženia a poradia obľúbených verziu potrebuje.
5. Better Auth kolekcia `user` sa nemení (nastavenia nie sú polia používateľa, spravuje ich aplikácia).

## Dôsledky

- Nastavenia idú s účtom na všetky zariadenia; pri zmazaní účtu treba zmazať aj tento dokument
  (doplniť do postupu mazania účtu, keď vznikne).
- Popis obľúbenej položky sa po premenovaní oblasti alebo klubu sám neaktualizuje – je to zámerne
  jednoduché; pri zobrazení ho možno neskôr dopĺňať z obsahu.
- Rozloženie analýzy ostáva v prehliadači (DA-c); presun do účtu je možný neskôr tou istou kolekciou.

## Zamietnuté alternatívy a prečo

- **Len v prehliadači (localStorage)** – jednoduché, ale na telefóne a počítači by sa líšilo
  (Cyril zvolil účet).
- **Polia v kolekcii Better Auth `user`** – kolekciu spravuje Better Auth a nečítame/nezapisujeme ju priamo.
- **Obľúbené pri klube (s `clubId`)** – obľúbené sú osobné a môžu odkazovať na viac klubov aj na
  spoločný obsah (oblasti, Metodika).
