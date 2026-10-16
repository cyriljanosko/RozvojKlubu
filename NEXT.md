# NEXT – ďalšie kroky

Aktualizované: 16. 10. 2026. Overuj proti `git log` – môže byť zastarané.

## Rozpracované

- [x] Mapa produktu z návrhov v artifactoch (`docs/produkt/mapa-produktu.md`) – schválená 16. 10., roly v klube v ADR 0004.
- [ ] Pilot Stupňa II podľa mapy, časť 11 (F1 → F7). Rozsah: Vizitka, Kompas v aplikácii s odoslaním mentorovi, Moja Akadémia (vedenie, tréner, mentor), Naši tréneri; 10 pilotných klubov z Vizitky.
- [ ] F2 – roly v klube a dáta pilotných klubov (vetva `feat/club-memberships`): hotové a overené lokálne 16. 10., čaká na PR.
  - Snapshot (10 klubov, 19 sezón) nahratý do `rozvojklubu_dev`, Cyril: admin SFZ, vedenie FK v Nižnom Žipove, mentor 10 klubov.
  - Snapshot leží len v `data/private/` na Macu – pri inom počítači treba súbor preniesť mimo gitu.
- [ ] F3 – spravovaný obsah (rozhodnuté 16. 10.: Markdown + `react-markdown`, len pre prihlásených, obsah môže byť vo verejnom gite, história zmien, „platné k“ a dátum revízie).
  - [x] F3a – oblasti a 220 otázok Kompasu v2 (vetva `feat/content-catalog`), naplnené v `rozvojklubu_dev`.
  - [ ] F3b – Metodika 11 oblastí (import z detailov, stránky `/oblasti/[číslo]`, editor sekcií).
  - [ ] F3c – Prax oblastí 3 a 4 (štruktúrovaný model pre všetky oblasti).
- [ ] Zdroj licencií trénerov pre F6 (Naši tréneri) – zatiaľ zo snapshotu.
- [ ] Sportnet API: verejné čítacie rozhranie existuje (kluby, družstvá, súpisky), zatiaľ ho nepoužívame (ADR 0005). Neverejné API s kľúčom – zistiť.

- [ ] F1 – zostáva:
  - [ ] Overiť prihlásenie na preview (čaká na Ecomail alebo Sportnet pre Preview).
  - [ ] Overiť názov hlavičky Ecomail API (`key`) pri prvom reálnom odoslaní – nepodarilo sa potvrdiť z dokumentácie.
  - [ ] Overiť názvy claimov v Sportnet ID tokene (meno, e-mail) po registrácii klienta.

## Pred prvými ostrými dátami

- [ ] Samostatná databáza pre Preview (vlastný DB používateľ, iné `MONGODB_URI`/`MONGODB_DB` pre Preview vo Verceli).
- [ ] Atlas: upgrade z M0 a obmedzenie DB používateľa len na svoju databázu.

## Čaká na niekoho iného

- [ ] Registrácia OAuth klienta v Sportnete (auth.sportnet.online) – client_id, client_secret, redirect URI.
- [ ] Ecomail: API kľúč a overená odosielateľská doména (DNS SPF/DKIM u správcu ltk.solutions).
- [ ] Ochrana vetvy `main` na GitHube (Settings → Branches).
- [ ] Prístup Claude ku GitHubu (zatiaľ push robí Cyril).

## Ďalej v poradí

- [ ] F1 / Krok 3 – Microsoft Entra ID (tenant SFZ) – registrácia aplikácie v Azure.
- [ ] Dependabot PR s veľkými verziami (ESLint 10, TypeScript 7, @types/node 26, actions v7) – prejsť riadene.
- [ ] Zrušiť nepoužívaný cluster v Atlas „Project 0“ (rozhodne Cyril).
- [ ] CS a EN preklady (`messages/cs.json`, `messages/en.json`).
