# 0030 – Záznam behov synchronizácie so Sportnetom (S3-b)

- Stav: **navrhnuté** – 6. 11. 2026; Ján zvolil začať S3 stránkou Sportnet, Cyril potvrdí zlúčením PR
- Dátum: 2026-11-06
- Pripravil: Ján Letko (Claude) · Rozhodol: Ján Letko · Potvrdí: Cyril Janoško
- Nadväzuje na: 0028 (kluby zo Sportnetu), 0029 (nočná synchronizácia klubov)
- Nahradené: 0031 (len bod 3 – meno pri ručnom behu)

## Kontext

Nočná synchronizácia klubov (ADR 0029) zapisuje výsledok len do logu funkcie vo Verceli. Logy vidí len ten, kto
má prístup do Vercelu, a po čase zmiznú. Administrácia (zadanie S3, obrazovka „Sportnet“ v G5) má ukázať, kedy
synchronizácia naposledy bežala, s akým výsledkom, a dovoliť ju spustiť ručne. Schválený návrh obrazovky G5
zatiaľ nie je k dispozícii, preto najprv vzniká serverová časť a API; obrazovka príde podľa návrhu.

## Rozhodnutie

1. **Nová kolekcia `sync_runs`** – jeden dokument na beh, ktorý zapisoval: `kind` (`sportnet-clubs`),
   `trigger` (`cron` / `manual`), `startedAt`, `finishedAt`, `ok`, `result` (len počty z `ClubSyncResult`),
   `error` (krátka technická správa, najviac 200 znakov) a `actorId` (ID používateľa pri ručnom behu).
   Žiadne názvy klubov, osoby ani e-maily. Index `{ kind: 1, startedAt: -1 }`.
2. **Zaznamenáva sa každý zapisujúci beh** – nočný aj ručný, úspešný aj neúspešný (chyba Sportnetu sa zapíše
   a beh skončí chybou ako doteraz). **Dry-run sa nezaznamenáva** – nič nemení.
3. **API pre admina SFZ:**
   - `GET /api/v1/admin/sportnet/sync` – stav: posledných 20 behov a stav klubov (aktívne kluby, bez
     podrobností, najstaršie podrobnosti).
   - `POST /api/v1/admin/sportnet/sync` – ručný beh rovnakej synchronizácie ako v noci; `{ apply?: boolean }`,
     bez `apply: true` je to dry-run (číta Sportnet, nezapisuje).
4. Kroky importu a podrobností z ADR 0028 (`/admin/sportnet/clubs`, `/admin/sportnet/clubs/details`) ostávajú.

## Dôsledky

- Stav synchronizácie je vidno bez prístupu do Vercelu; obrazovka G5 „Sportnet“ ho len zobrazí.
- Kolekcia rastie o jeden dokument za noc (plus ručné behy) – stovky dokumentov ročne, bez mazania. Čistenie
  (TTL) sa doplní, ak by to bolo treba.
- Ručný beh počas nočného nie je blokovaný; oba zapisujú rovnaké hodnoty, druhý len zbytočne zaťaží Sportnet.
- Ďalšie synchronizácie (číselníky S3) použijú tú istú kolekciu s iným `kind`.

## Zamietnuté alternatívy a prečo

- **Len log vo Verceli** – admin SFZ k nemu nemá prístup a logy po čase miznú.
- **Posledný výsledok v dokumente klubu alebo v nastaveniach** – história behov by sa stratila a chyba by
  prepísala posledný úspešný výsledok.
- **Zaznamenávať aj dry-run** – nemení dáta a história by sa zahltila skúšobnými behmi.
