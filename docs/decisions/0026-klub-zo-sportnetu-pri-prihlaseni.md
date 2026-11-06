# 0026 – Klub zo sportnet.online pri prihlásení, S2-b po etapách

- Stav: **prijaté** – rozhodnutie 6. 11. 2026 (Ján Letko, SFZ); Cyril potvrdí zlúčením PR
- Dátum: 2026-11-06
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0005 (zdroj dát klubov), 0021 (roly v klube zo Sportnetu), 0024 (klubový manažér aj `matrikar`)
- Nahrádza: 0021 (dôsledok „kluby mimo pilotu sa ignorujú, kým S3 nenačíta kluby zo Sportnetu“ – pre rolu
  klubového manažéra; ostatné časti 0021 platia)

## Kontext

ADR 0021 počíta s tým, že roly zo Sportnetu dostane osoba len v kluboch, ktoré už v aplikácii sú (10 pilotných
klubov zo snapshotu). Prvé ostré prihlásenie (Ján, 6. 11.) ukázalo, čo to znamená v praxi: klubový manažér
MFK Nová Baňa má v CRM klubu rolu klubového manažéra, ale klub v aplikácii nie je, takže by rolu nedostal ani po S2-b.
Kluby zo Sportnetu načíta až S3.

Zároveň plné S2 podľa ADR 0021 (premenovanie `management` → `club_manager`, nové roly `team_manager`,
`player`, `member` a matica prístupov k nim) zasahuje do zhruba 50 súborov, katalógu rolí a obsahu
(`content/roly.json`). Klubový manažér sa dá dodať samostatne a bez migrácie.

## Rozhodnutie

1. **Klub, ktorý v aplikácii nie je, sa pri prihlásení založí**, ak má osoba v jeho CRM rolu klubového manažéra
   (ADR 0024) a PPO je klub (`org_profile.type = "club"`). Zväzy (`union`, napr. `futbalsfz.sk`), školy a iné
   typy PPO sa nezakladajú. Záznam má `clubId` = appSpace, názov z `org_profile.name`, `source: "sportnet"`;
   zväz, región a slug ostávajú prázdne, kým ich nedoplní S3. Existujúci klub sa nemení.
2. Kluby sa zakladajú **len z roly klubového manažéra**, nie z hráčskych či odborných príslušností – tie by
   založili klub každému hráčovi.
3. **S2-b po etapách.** Táto etapa: rola klubového manažéra z `/me/appspaces` pri každom prihlásení cez
   Sportnet, v aplikácii pod dnešným kódom `management` („Manažér a výbor“). Väzby majú `source: "sportnet"`,
   `sportnetRef: "appspace:CRM"`, `validTo` a `syncedAt`; pri každom prihlásení sa prepíšu. Ručné väzby
   (`source` chýba alebo `"app"`) ostávajú, rovnakú rolu zo Sportnetu sa neduplikuje.
4. **Bez migrácie.** Nové polia sú voliteľné; väzba bez `source` sa číta ako `"app"`. Premenovanie na
   `club_manager`, roly `team_manager`, `player`, `member` (zo `/me/sport-orgs`, `/me/sport-expert-orgs`)
   a ich prístupy prídu v ďalšej etape spolu s migráciou (súhlas Jána 6. 11. platí, dry-run pred zápisom).

## Dôsledky

- Klubový manažér z ISSF má po prvom prihlásení cez Sportnet svoj klub v aplikácii aj keď nie je v pilote.
- Počet klubov v aplikácii rastie s prihláseniami. Verejné zoznamy klubov (Kompas na vyskúšanie, vizitky,
  rebríčky) ich ukážu – nový klub nemá dáta sezóny (snapshot), kým ich nedoplní S3.
- Admin SFZ môže väzbu zo Sportnetu zmazať, pri ďalšom prihlásení sa však vráti; odobratie roly patrí do
  Sportnet adminu (ADR 0024).
- Kód roly ostáva `management`, kým ho ďalšia etapa nepremenuje.

## Zamietnuté alternatívy a prečo

- **Len pilotné kluby (ADR 0021)** – klubový manažér mimo pilotu by rolu nedostal, kým S3 nenačíta kluby;
  pilot by sa nedal rozšíriť bez ručného importu.
- **Zakladať klub aj z hráčskych a odborných príslušností** – každý hráč by založil klub; o klube má
  rozhodovať jeho vedenie.
- **Celé S2 naraz** – veľká zmena s migráciou rolí aj obsahu, zatiaľ čo klubový manažér je hotový za zlomok
  rozsahu a dá sa overiť na ostrom účte.
