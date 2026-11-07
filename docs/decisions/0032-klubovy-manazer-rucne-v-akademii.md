# 0032 – Klubový manažér pridaný ručne v Akadémii

- Stav: **prijaté** – 7. 11. 2026 (Ján Letko, SFZ)
- Dátum: 2026-11-07
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko
- Nadväzuje na: 0021 (roly v klube zo Sportnetu), 0024 (klubový manažér), 0027 (roly z príslušností)

## Kontext

Klubový manažér sa preberá zo Sportnetu z roly v CRM klubu (ADR 0027). Tréner sa priraďuje ručne v Akadémii,
lebo väzba tréner ↔ klub v Sportnete chýba. Návrh G5 „Osoby a členstvá“ ponúka v okne „Pridať rolu v Akadémii“
aj voľbu „Klubový manažér (výnimka)“ a podklady G5 (otázka č. 2) sa pýtali, či ju admin smie použiť. Klub môže
mať správcu, ktorý v CRM Sportnetu rolu nemá, alebo CRM klubu ešte nikto nenastavil.

## Rozhodnutie

1. **Admin SFZ smie klubového manažéra pridať ručne** ako rolu zo zdroja Akadémia (`source: "app"`).
2. Ručná rola sa pri prihlásení nezmaže ani neprepíše – synchronizácia rolí mení len roly zo Sportnetu
   (ADR 0027 bod 3). Odobrať ju môže len admin SFZ.
3. V Osobách a členstvách má ručne pridaný klubový manažér odznak zdroja „Akadémia“, aby bolo vidieť, že nejde
   o rolu zo Sportnetu.

## Dôsledky

- Služba `addClubMember` to už dnes dovoľuje (všetky roly v klube); obrazovka Osoby (G5) ponúkne Trénera
  aj Klubového manažéra.
- Klub môže mať klubového manažéra zo Sportnetu aj z Akadémie naraz.

## Zamietnuté alternatívy a prečo

- **Len tréner ručne** – klub bez nastaveného CRM by nemal správcu, kým ho Sportnet nedoplní.
