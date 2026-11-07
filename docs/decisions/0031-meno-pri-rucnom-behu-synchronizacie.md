# 0031 – Meno pri ručnom behu synchronizácie

- Stav: **prijaté** – 7. 11. 2026 (Ján Letko, SFZ)
- Dátum: 2026-11-07
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko
- Nadväzuje na: 0030 (záznam behov synchronizácie)
- Nahrádza: 0030 bod 3 v časti, podľa ktorej API stavu nevracia, kto ručný beh spustil

## Kontext

ADR 0030 ukladá ku každému ručnému behu `actorId`, ale `GET /api/v1/admin/sportnet/sync` ho zámerne nevracal.
Stránka Sportnet (G5) preto v stĺpci „Spustil“ ukazovala len „Ručne“. Podklady G5 (otázka č. 4) nechali
na rozhodnutie, či sa má meno zobrazovať.

## Rozhodnutie

1. **Meno sa zobrazuje.** Pri ručnom behu vracia API `actorName`: meno používateľa, bez mena jeho e-mail; ak
   účet už neexistuje, prázdny text; pri nočnom behu `null`. Stránka Sportnet ukazuje „Ručne · {meno}“.
2. **Meno sa aj loguje.** `actorId` ostáva v `sync_runs` (ADR 0030) a zapisujúci ručný beh zapíše do logu
   funkcie riadok s ID používateľa. Meno ani e-mail sa do `sync_runs` neukladajú – číta sa vždy aktuálne cez
   Better Auth.
3. Stránku a API vidí len admin SFZ, ako doteraz.

## Dôsledky

- Admin SFZ vidí, kto z kolegov spustil zápis. Nočný beh ostáva bez mena.
- Jedno čítanie používateľa na každého iného autora v posledných 20 behoch.

## Zamietnuté alternatívy a prečo

- **Len „Ručne“ bez mena** (pôvodný stav) – pri viacerých adminoch nie je jasné, kto zmenil dáta.
- **Uložiť meno do `sync_runs`** – kópia osobného údaju, ktorá by po zmene mena alebo zmazaní účtu ostala.
