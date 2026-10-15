# NEXT – ďalšie kroky

Aktualizované: 15. 10. 2026. Overuj proti `git log` – môže byť zastarané.

## Rozpracované

- [ ] F1 / Krok 1 – základ prihlasovania (Better Auth): Sportnet OIDC ako hlavný spôsob, e-mailový odkaz (Ecomail) ako doplnok, 6 rolí, API `/api/v1/me` a zmena roly, UI `/prihlasenie` a `/ucet`.

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
