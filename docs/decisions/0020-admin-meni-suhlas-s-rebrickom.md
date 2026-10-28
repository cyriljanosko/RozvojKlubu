# 0020 – Admin SFZ môže meniť súhlas klubu s rebríčkom

- Stav: prijaté
- Dátum: 2026-10-27
- Rozhodol: Cyril Janoško
- Nahrádza: 0015 (len to, kto mení súhlas s verejným rebríčkom – bod 1 a dôsledok „Súhlas dáva len vedenie klubu, nie admin SFZ za klub.“; ostatné body 0015 platia)

## Kontext

Podľa ADR 0015 dáva súhlas so zaradením do verejného rebríčka len vedenie klubu; admin SFZ ho
nemôže zmeniť ani na žiadosť klubu. Analýza obrazoviek (`docs/dizajn/analyza-obrazoviek.md`,
kap. 3.3, bod 4) na to upozornila: keď vedenie v aplikácii chýba alebo požiada SFZ o zmenu
(napr. e-mailom), admin SFZ nemá ako pomôcť a klub ostane v stave, ktorý nechce.

## Rozhodnutie

1. Súhlas s verejným rebríčkom (`club_settings.rankingConsent`) dáva alebo ruší **vedenie klubu
   alebo admin SFZ** za klub.
2. Pri každej zmene sa ukladá, kto ju urobil (`rankingConsent.by`, `updatedBy`) – zmena adminom
   je dohľadateľná.
3. Vedenie klubu môže zmenu urobenú adminom kedykoľvek zmeniť späť – rozhodnutie ostáva na klube,
   admin ho len vykoná.
4. Tréner a mentor súhlas ďalej len vidia.

## Dôsledky

- `setRankingConsent` a `canEdit` v `club-settings.service.ts` pustia admina SFZ; vo Vizitke klubu
  vidí admin prepínač súhlasu ako vedenie.
- Opt-in z ADR 0015 platí ďalej: bez rozhodnutia (vedenia alebo admina na jeho žiadosť) klub
  v rebríčku nie je.
- Kto súhlas zmenil, sa zatiaľ v rozhraní neukazuje – údaj je v dátach.

## Zamietnuté alternatívy a prečo

- **Ponechať len vedenie (ADR 0015)** – klub bez vedenia v aplikácii alebo so žiadosťou cez SFZ by
  nemal ako svoje rozhodnutie presadiť.
- **Admin len ruší súhlas, nedáva ho** – žiadosť klubu môže ísť oboma smermi; rozlišovanie by
  komplikovalo pravidlo bez zjavného prínosu.
