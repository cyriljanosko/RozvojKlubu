# 0005 – Dáta klubov: ID = Sportnet appSpace, zatiaľ zo snapshotu

- Stav: prijaté
- Dátum: 2026-10-16
- Rozhodol: Cyril Janoško

## Kontext

Pilot Stupňa II potrebuje o 10 pilotných kluboch družstvá, súťaže, hráčov a trénerov s licenciami
(Vizitka, Naši tréneri). Neverejné Sportnet API s kľúčom zatiaľ nemáme. Návrh Vizitky obsahuje snapshot
týchto dát k 11. 10. 2026 (2 sezóny). Snapshot má mená a licencie skutočných trénerov a repozitár je verejný.

ID klubov sa v návrhoch líšia (`klub-11686`, `issf_club_11686`, futbalnet slug). Podľa dokumentácie Sportnetu
je klub organizácia (PPO) a jej identifikátor je **appSpace** (`organization_profiles._id`). Overené 16. 10. 2026 jednorazovým čítaním verejného registra: všetkých 10 kódov z poľa `app` vo Vizitke je platný
appSpace klubu (`type: club`, `status: active`).

Sportnet má aj verejné čítacie rozhranie pre družstvá a súpisky (bez licencií trénerov).

## Rozhodnutie

- **`clubId` = Sportnet appSpace** (napr. `slavoj-trebisov.futbalnet.sk`, `issf_club_11686`). Je to tenant
  podľa ADR 0003.
- Dáta klubov sa zatiaľ berú **zo snapshotu Vizitky**. Admin SFZ ho nahrá do aplikácie (import v administrácii),
  aplikácia ho uloží do MongoDB s dátumom stavu.
- **Snapshot s menami osôb sa necommituje.** Lokálne leží v `data/private/` (v `.gitignore`); v gite sú len
  testovacie dáta s vymyslenými menami.
- Prístup k dátam klubov ide cez rozhranie zdroja dát v service vrstve, aby sa neskôr dal snapshot nahradiť
  Sportnet API bez zmeny zvyšku aplikácie.
- **Verejné API Sportnetu sa zatiaľ nepoužíva** (rozhodnutie Cyrila).

## Dôsledky

- Nové kolekcie `clubs` a `club_seasons` (súhlas pred vytvorením), index `clubId` unikátny a `{ clubId, season }` unikátny.
- Dáta sú statické k dátumu snapshotu; UI to zobrazuje („Dáta zo Sportnetu k …“).
- Mená trénerov sú v databáze (zdieľaná `rozvojklubu_dev`) – zobrazia sa len rolám s prístupom ku klubu (F6).

## Zamietnuté alternatívy a prečo

- **Verejné API Sportnetu (živé dáta)** – zatiaľ nie, rozhodnutie Cyrila 16. 10. 2026. Môže nahradiť snapshot neskôr.
- **Snapshot ako súbor v gite** – verejný repozitár by zverejnil mená a licencie osôb.
- **Vlastné ID klubov** – ďalšie mapovanie bez úžitku; appSpace je to, čo používa celý Sportnet.
