# NEXT – ďalšie kroky

Aktualizované: 15. 10. 2026. Overuj proti `git log` – môže byť zastarané.

## Rozpracované

- [ ] F1 / Krok 1 – základ prihlasovania (vetva `feat/auth-base`): kód hotový, čaká na review/PR a na nasadenie.
  - [ ] Súhlas s novými kolekciami Better Auth v DB (`user`, `session`, `account`, `verification`).
  - [ ] Doplniť premenné vo Verceli a `.env.local`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `INITIAL_ADMIN_EMAILS`, neskôr Ecomail a Sportnet.
  - [ ] Overiť end-to-end prihlásenie e-mailovým odkazom (lokálne alebo na preview).
  - [ ] Overiť názov hlavičky Ecomail API (`key`) pri prvom reálnom odoslaní – nepodarilo sa potvrdiť z dokumentácie.
  - [ ] Overiť názvy claimov v Sportnet ID tokene (meno, e-mail) po registrácii klienta.

## Čaká na niekoho iného

- [ ] Registrácia OAuth klienta v Sportnete (auth.sportnet.online) – client_id, client_secret, redirect URI.
- [ ] Ecomail: API kľúč a overená odosielateľská doména (DNS SPF/DKIM u správcu ltk.solutions).
- [ ] Ochrana vetvy `main` na GitHube (Settings → Branches).
- [ ] Prístup Claude ku GitHubu (zatiaľ push robí Cyril).

## Ďalej v poradí

- [ ] F1 / Krok 3 – Microsoft Entra ID (tenant SFZ) – registrácia aplikácie v Azure.
- [ ] Dependabot PR s veľkými verziami (ESLint 10, TypeScript 7, @types/node 26, actions v7) – prejsť riadene.
- [ ] Obmedziť DB používateľa `rozvojklubu-app-dev` len na databázu `rozvojklubu_dev`.
- [ ] Zrušiť nepoužívaný cluster v Atlas „Project 0“ (rozhodne Cyril).
- [ ] F2 – integrácia Sportnet API.
