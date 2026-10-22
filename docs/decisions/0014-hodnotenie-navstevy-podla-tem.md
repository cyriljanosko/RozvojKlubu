# 0014 – Hodnotenie návštevy podľa tém

- Stav: prijaté
- Dátum: 2026-10-22
- Rozhodol: Cyril Janoško
- Nahrádza: 0013 (bod 4 – hodnotenie v štyroch poliach; čiastočne)

## Kontext

ADR 0013 zaviedol pri návšteve hodnotenie v štyroch poliach (silné stránky, slabé stránky,
odporúčania, celkové hodnotenie) pre celé stretnutie. Pri skúške formulára Cyril upresnil, že
hodnotenie má nadväzovať na zvolené témy stretnutia: pri troch témach tri hodnotenia.

## Rozhodnutie

1. Pri **každej zvolenej téme** (0–3 oblasti) je jeden blok hodnotenia s **tromi poľami** – silné
   stránky, slabé stránky, odporúčania. Bloky sa pridávajú a uberajú podľa zvolených tém.
2. **Celkové hodnotenie stretnutia** je jedno spoločné pole.
3. Stretnutie **bez témy** má jeden všeobecný blok (oblasť prázdna).
4. **Zistenia k oblastiam** sa pri nových návštevách nezadávajú (prekrývajú sa s hodnotením po
   témach); pri starších zostávajú.
5. Odstránenie témy s vyplneným hodnotením sa potvrdzuje; text všeobecného bloku sa pri výbere
   prvej témy presunie k nej.
6. V dátach `assessment: { topics: [{ area, strengths, weaknesses, recommendations }], overall }`;
   prvý tvar z 22. 10. (štyri polia) sa pri čítaní premení na všeobecný blok – bez migrácie.

## Dôsledky

- Server odmietne blok k oblasti, ktorá nie je témou, aj dva bloky k jednej téme; prázdne bloky
  zahodí.
- Hodnotenie sa dá porovnávať po oblastiach (napr. neskôr v analýze alebo pri zameraní mentora).

## Zamietnuté alternatívy a prečo

- **Štyri polia pri každej téme bez spoločného hodnotenia** – Cyril zvolil jedno celkové hodnotenie.
- **Téma povinná pri zápise** – stretnutie bez témy ostáva možné so všeobecným blokom.
