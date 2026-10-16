# NEXT – ďalšie kroky

Aktualizované: 16. 10. 2026. Overuj proti `git log` – môže byť zastarané.

## Rozpracované

- [x] Mapa produktu z návrhov v artifactoch (`docs/produkt/mapa-produktu.md`) – schválená 16. 10., roly v klube v ADR 0004.
- [ ] Pilot Stupňa II podľa mapy, časť 11 (F1 → F7). Rozsah: Vizitka, Kompas v aplikácii s odoslaním mentorovi, Moja Akadémia (vedenie, tréner, mentor), Naši tréneri; 10 pilotných klubov z Vizitky.
- [ ] Zistiť prístup k Sportnet API (endpointy, kľúč) – dovtedy import snapshotu.

- [ ] F1 / Krok 1 – základ prihlasovania (vetva `feat/auth-base`): PR #7 → #8 → #9 otvorené, CI zelené, čaká na zlúčenie.
  - [x] Súhlas s novými kolekciami Better Auth v DB (`user`, `session`, `account`, `verification`) – 16. 10.
  - [ ] Doplniť premenné vo Verceli (Production aj Preview): `BETTER_AUTH_SECRET` povinne pred zlúčením do `main`; Production `BETTER_AUTH_URL`, `APP_URL`, `INITIAL_ADMIN_EMAILS`; neskôr Ecomail a Sportnet.
  - [x] Overiť end-to-end prihlásenie e-mailovým odkazom lokálne s DB `rozvojklubu_dev` – 16. 10. (`/ucet`, `/api/v1/me`, 375 px).
  - [ ] Preview: odkazy a callbacky berú `BETTER_AUTH_URL`/`APP_URL`, nie adresu nasadenia → prihlásenie na preview nefunguje (malý PR, napr. `VERCEL_URL`).
  - [ ] Overiť názov hlavičky Ecomail API (`key`) pri prvom reálnom odoslaní – nepodarilo sa potvrdiť z dokumentácie.
  - [ ] Overiť názvy claimov v Sportnet ID tokene (meno, e-mail) po registrácii klienta.

- [ ] Zapracovanie šablóny konvencií (vetva `chore/template-conventions`, stojí na `feat/auth-base`): čaká na review/PR.

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
- [ ] F2 – integrácia Sportnet API.
- [ ] CS a EN preklady (`messages/cs.json`, `messages/en.json`).
- [ ] Tenant filter `clubId` v service vrstve s prvými klubovými dátami (ADR 0003).
