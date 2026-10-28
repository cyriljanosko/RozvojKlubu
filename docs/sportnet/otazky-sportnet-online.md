# Rozvoj klubu × sportnet.online – OAuth klient a otázky pre vývojárov

> Stav: 28. 10. 2026 – OAuth klienta nastaví a otázky vývojárom sportnet.online pošle Ján (SFZ); Cyril dostane hodnoty do Vercelu.
> Kontext: ADR 0002 (prihlásenie Sportnet), ADR 0021 (roly v klube), zadanie `zadanie-s1-s3.md`.
> Overené v dokumentácii auth.sportnet.online a CoreApi a na živom verejnom API 28. 10. 2026.

## A. Čo potrebuje aplikácia od OAuth klienta v sportnet.online

Aplikácia Rozvoj klubu (Akadémia vzdelávania SFZ, https://rozvojklubu.ltk.solutions) sa prihlasuje cez
auth.sportnet.online ako OIDC klient (Better Auth, `genericOAuth`, Authorization Code + PKCE S256). Kód je
v `src/server/auth/sportnet.ts`; bez `SPORTNET_OAUTH_CLIENT_ID` a `SPORTNET_OAUTH_CLIENT_SECRET` je tlačidlo
Sportnet skryté.

| #   | Čo                             | Hodnota / požiadavka                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `client_id` (app `_id`)        | návrh **`rozvojklubu`** (primárna aplikácia, `flags: primary`)                                                                                                                                                                                                                                                                                                              |
| A2  | `secret`                       | vygeneruje Sportnet; do Vercelu (Production + Preview) a `.env.local` ako `SPORTNET_OAUTH_CLIENT_SECRET`, nikdy do repozitára                                                                                                                                                                                                                                               |
| A3  | `allowed_hosts` (redirect URI) | `localhost:3000` (vývoj), `rozvojklubu.ltk.solutions` (produkcia), `rozvojklubu-cyro5.vercel.app` a **Preview `rozvojklubu-git-<vetva>-cyro5.vercel.app`** – mení sa s každou vetvou; **otázka A3**: podporuje `allowed_hosts` wildcard `*.vercel.app` alebo `rozvojklubu-git-*-cyro5.vercel.app`? Ak nie, Preview bude testovať Sportnet len cez jednu pevnú vetvu/doménu. |
| A4  | Redirect URI (cesta)           | `https://<host>/api/auth/oauth2/callback/sportnet` (Better Auth `genericOAuth`, provider id `sportnet`)                                                                                                                                                                                                                                                                     |
| A5  | Granty                         | `authorization_code` + PKCE (S256), `refresh_token` (obnova rolí po 15 min, ADR 0021 časť 3), **`client_credentials`** (aplikačný token `sportnet_app` pre S3 – pozri A5 nižšie)                                                                                                                                                                                            |
| A6  | `response_types`               | `code`                                                                                                                                                                                                                                                                                                                                                                      |
| A7  | Scope                          | `openid` (ID token). **Otázka:** potrebujú `GET /me/appspaces`, `/me/sport-orgs`, `/me/sport-expert-orgs` iný scope? Dokumentácia hovorí, že `/me/*` prijíma token ľubovoľnej aplikácie (`sportnet_user`).                                                                                                                                                                  |
| A8  | Claims v ID tokene             | Kód mapuje `sub`, `email`, `name`, `surname`, `dnm`/`displayName`, `photo`/`picture` (defenzívne – presné názvy neoverené). **Otázka:** aké profilové claims ID token pri `openid` nesie, a je `email` vždy prítomný (účty bez e-mailu)?                                                                                                                                    |
| A9  | `client_credentials_roles`     | Aké app roly (`app:` ACL) dostane aplikačný token, aby mohol čítať `GET /crm/{appSpace}/users` a `GET /appgrant/CRM/{appSpace}` pre kluby SFZ (S3: osoby a správcovia klubu bez prihláseného používateľa)? Alebo treba `ppoApiKey` za každý klub (nepraktické pri ~2 000 kluboch)?                                                                                          |
| A10 | Detská aplikácia CRM?          | Ak by bola `rozvojklubu` registrovaná ako detská aplikácia CRM, prišli by CRM roly používateľa v `rls` claime a `/me/appspaces` by nebolo treba. Je to možné/želané? (Zatiaľ s tým nepočítame.)                                                                                                                                                                             |

Prostredia a kde hodnoty nastaviť: `.env.example` (`SPORTNET_AUTH_URL=https://auth.sportnet.online`,
`SPORTNET_OAUTH_CLIENT_ID`, `SPORTNET_OAUTH_CLIENT_SECRET`), Vercel projekt `rozvojklubu` (tím cyro5) –
Production a Preview; lokálne `.env.local` (Cyril, Ján).

## B. Otázky pre vývojárov sportnet.online (dáta o osobách v kluboch)

Čo sme zistili na verejnom API (bez tokenu, kluby Slavoj Trebišov, ŠKM Liptovský Hrádok, MFK Dukla B. Bystrica):

- `GET /ppo/{appSpace}/users?affiliationCategory=sport_expert_orgs` vracia klubové funkcie s `competence_type`
  ako **zmes kódov číselníka** (`functionary`, `matchmaker`, `organizer`, `security_manager`, `masseur`,
  `hlasatel`, `timekeeper`, `reporter`, `technical_worker`) **a doslovných slovenských názvov z ISSF**
  (`Vedúci družstva`, `Vedúci družstva / Tímový manažér`, `Lekár / Zdravotník`, `Hlavný usporiadateľ`,
  `Videotechnik`, `Kustod`, `Fyzioterapeut`), ktoré v `GET /codelist/sport-expert-competence-type` nie sú.
- `competence_type: "coach"` sa v klubových príslušnostiach troch klubov nevyskytuje ani raz (celkom 162 osôb
  s funkciou). Trénerská licencia je v `sport_expert_orgs` s `org_profile_id = futbalsfz.sk`.
- Verejný zoznam nevracia `isActive` ani `sport_expert_licenses`; filter `competenceTypes` sa neuplatní.

| #   | Otázka                                                                                                                                                                                                                                                         | Prečo to potrebujeme                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| B1  | **Kde je väzba tréner ↔ klub?** V ISSF má tréner klubovú príslušnosť (typ osoby Tréner + klub). V Sportnete vidíme len licenciu pri zväze. Je tréner klubu v `sport_expert_orgs` s `org_profile_id` klubu niekde inde (iný PPO, iné pole), alebo sa nezrkadlí? | Rola Tréner v aplikácii (ADR 0021) – dovtedy ručne.         |
| B2  | Budú slovenské názvy funkcií z ISSF (`Vedúci družstva`, `Lekár / Zdravotník`, …) skodifikované do číselníka `sport-expert-competence-type`? Ak áno, kedy a s akými kódmi? Môžeme sa spoľahnúť na dnešné reťazce?                                               | Normalizácia `competence_type` v `deriveClubRoles`.         |
| B3  | Akú rolu v `CRM:{appSpace}` klubu dostáva klubový manažér z ISSF (`admin`, `manager`, iná)? A je rola v CRM jediný príznak „správca klubu“, alebo existuje aj iná väzba (napr. `ppoRelations`, `grant`)?                                                       | Rola Klubový manažér (rozhodnuté: `admin` alebo `manager`). |
| B4  | Aký je tvar odpovede `GET /me/appspaces` (polia `app_id`, `app_space`, `role`, `grant`, `validTo`, `child_apps_role`)? Vracia aj aplikácie, kde má používateľ len `child_apps_role`?                                                                           | Klient Sportnetu v S2 (mock v testoch).                     |
| B5  | Stačí `openid` scope pre `/me/appspaces`, `/me/sport-orgs`, `/me/sport-expert-orgs` tokenom našej aplikácie? Vracajú `/me/*` aj `isActive`?                                                                                                                    | Obnova rolí pri prihlásení.                                 |
| B6  | Tímový manažér (ISSF P31, `TIMOVY_ISSF_MANAZER`) – plánuje sa zrkadlenie do Sportnetu? Stačí nám funkcia „Vedúci družstva“?                                                                                                                                    | Rola Tímový manažér.                                        |
| B7  | Aplikačný token (`client_credentials`) – ktoré `app:` roly potrebuje `rozvojklubu`, aby čítala `GET /appgrant/CRM/{appSpace}` (správcovia klubu) a `GET /crm/{appSpace}/users` pre všetky kluby SFZ? Je na to proces (žiadosť SFZ)?                            | S3 – osoby a správcovia klubu bez prihláseného používateľa. |
| B8  | Limity: rate limit CoreApi pre verejné `/ppo/{appSpace}/users` (stránkované po 100) a `/me/*`; odporúčaný interval hromadného čítania klubov (S3 číselníky: kluby, zväzy RFZ/ObFZ, vekové kategórie).                                                          | Synchronizácia klubov v S3.                                 |
| B9  | Testovacie prostredie: existuje staging auth/CoreApi, alebo testujeme na produkcii s testovacím klubom a účtami? Môže mať Cyril alebo Ján rolu `manager` v CRM testovacieho klubu?                                                                             | Overenie S1 a S2 na Preview bez zásahu do ostrých dát.      |

## C. Čo sme sa rozhodli sami (bez sportnet.online)

- Tokeny: používateľský token (15 min) + refresh (24 h) z Better Auth `account`; aplikačný token
  `client_credentials` (rovnaký `client_id` a `secret`, `POST https://auth.sportnet.online/token`,
  HTTP Basic) až v S3 – nie je to JWT používateľa, je to token aplikácie samej, bez `sub`.
- Roly: pri prihlásení + ručne, bez cronu (ADR 0021, časť 3).
- Osoby v kluboch pre S3: verejný `GET /ppo/{appSpace}/users` bez tokenu; CRM endpointy len ak B7 dovolí.
