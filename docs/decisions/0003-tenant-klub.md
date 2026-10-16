# 0003 – Tenant je klub

- Stav: prijaté
- Dátum: 2026-10-15
- Rozhodol: Cyril Janoško

## Kontext

Konvencie projektov (šablóna CLAUDE.md) vyžadujú, aby každý dotaz do databázy obsahoval tenant filter.
Aplikácia hodnotí a porovnáva kluby (vizitka, 10 oblastí rozvoja, licencie, pokrok členov). Únik dát
medzi klubmi je najväčšie riziko – nesmie nastať ani pri chybe v kontrole oprávnení.

## Rozhodnutie

- **Tenant = klub**, identifikovaný Sportnet ID klubu (`clubId`).
- Každý dotaz na dáta klubu obsahuje filter `clubId`, bez výnimky, aj pri administrátorských operáciách.
- ObFZ/RFZ a admin SFZ pracujú s **explicitným zoznamom povolených klubov** (`clubId: { $in: [...] }`), nikdy bez filtra.
- Spoločný obsah (kurzy, metodika, 10 oblastí ako šablóna) je globálny a tenant nemá.
- Väzba používateľ ↔ klub(y) a rola v klube sa uloží v aplikácii; zdrojom informácie o kluboch je Sportnet.

## Dôsledky

- Klubové kolekcie budú mať pole `clubId` a zložený index začínajúci `clubId`.
- Service vrstva dostane pomocníka na tenant filter a testy na izoláciu klubov.
- Pravidlo sa uplatní od prvých klubových dát (F3); prihlasovanie (F1) sa ho netýka.

## Zamietnuté alternatívy a prečo

- **Oblastný zväz** – jednoduchšie, ale manažér klubu by technicky videl dáta iných klubov v oblasti.
- **Klub aj zväz (dvojúrovňovo)** – najpresnejšie, ale zbytočná zložitosť pri každom dotaze; zväzový pohľad pokryje zoznam klubov.
- **Žiadny tenant** – chyba v oprávneniach by znamenala únik dát medzi klubmi.
