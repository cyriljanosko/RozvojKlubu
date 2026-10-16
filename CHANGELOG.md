# Changelog

Formát podľa [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [Unreleased]

### Pridané

- Vizitka klubu (F5c, ADR 0007): verejná `/vizitka/[clubId]` bez prihlásenia (profil klubu a hodnotenie oblastí odoslaného Kompasu a uzavretého licenčného hodnotenia) a `/klub/[clubId]/vizitka` pre roly (navyše dátumy, koeficient, stav rozpracovaného hodnotenia, odkazy na detail); prepínanie sezón, odkaz z karty klubu.
- Licenčné hodnotenie v UI (F5b): `/klub/[clubId]/licencne-hodnotenie` – prehľad 6 oblastí s pásmami, oblasti 2–4 zo Sportnetu (tabuľky, tréneri s opravou pohlavia), formuláre 5–7, počet obyvateľov a koeficient, priebežný výpočet, uloženie, uzavretie sezóny s potvrdením, prepínanie sezón; odkaz z karty klubu.
- Licenčné hodnotenie – základ (F5a, ADR 0006): pravidlá „pilot 2026, predbežné“ z Vizitky (oblasti 2–4 zo Sportnetu, 5–7 vstupy klubu, koeficient sídla, pásma), uloženie na sezónu s verziou (vedenie, mentor, admin; tréner číta), uzavretie sezóny ako zmrazená kópia; `GET|PUT /api/v1/clubs/:clubId/licensing`, `GET|POST .../licensing/submissions`.
- Odoslanie Kompasu mentorovi (F4c): zmrazená kópia (odpovede, znenie otázok, výsledok) pri každom odoslaní, história odoslaných verzií s detailom, riadok `SFZ-KOMPAS-1` na skopírovanie do zbernej tabuľky, prehľad mentora `/mentor` (len odoslané hodnotenia); API `GET|POST /api/v1/clubs/:clubId/kompas/submissions`, `GET .../submissions/:id`, `GET /api/v1/mentor/clubs`.
- Kompas klubu v aplikácii (F4b): `/klub/[clubId]/kompas` – zaškrtávanie s priebežným skóre, pásma oblastí, „Čo urobiť najbližšie“ s odkazmi na Metodiku a Prax, uloženie (vedenie), čítanie (tréner); odkaz z karty klubu; blok „Kde stojí váš klub“ v Praxi oblastí 3 a 4.
- Kompas klubu – základ (F4a): výpočet skóre podľa Kompasu v2 (platnosť otázok podľa kategórií klubu zo Sportnetu, minimum 3 platných otázok, pásma, čo urobiť najbližšie), uloženie odpovedí vedením klubu s verziou, `GET|PUT /api/v1/clubs/:clubId/kompas`.
- Prax oblastí 3 a 4 (F3c): obsah z návrhov prevedený do `content/prax`, zobrazenie podľa roly na stránke oblasti (karty Metodika / Prax), úprava ako JSON s kontrolou štruktúry, históriou a vrátením.
- Metodika 11 oblastí (F3b): obsah detailov prevedený do Markdownu (`content/metodika`), stránky `/oblasti` a `/oblasti/[číslo]` pre prihlásených, úprava sekcií adminom s „platné k“, „revidované“, históriou a vrátením. Nové závislosti `react-markdown`, `remark-gfm`.
- Spravovaný obsah (F3a): 11 oblastí a 220 otázok Kompasu v2 v databáze, úprava otázok adminom SFZ s verziou, históriou zmien a vrátením (`/admin/obsah`, `/api/v1/areas`, `/api/v1/kompas/questions`).
- Kluby zo Sportnetu (snapshot, ADR 0005): import v administrácii (`/admin/kluby`, `POST /api/v1/admin/club-snapshot`), karta klubu `/klub/[clubId]` s počtami a družstvami podľa sezóny.
- Roly v klube (ADR 0004): vedenie, tréner, mentor na sezónu; pridelenie a odobratie adminom SFZ (`/admin/kluby/[clubId]`, `/api/v1/clubs/:clubId/members`); „Moje kluby“ na `/ucet`; `GET /api/v1/clubs`.
- Prihlasovanie cez Better Auth: e-mailový odkaz (Ecomail, v dev režime do logu), príprava na Sportnet OIDC (zapne sa po doplnení client_id/secret).
- Roly (admin SFZ, ObFZ/RFZ, manažér klubu, mentor, dobrovoľník, verejnosť); prví admini cez `INITIAL_ADMIN_EMAILS`.
- API `GET /api/v1/me` a `PATCH /api/v1/users/:id/role` (len admin SFZ, ochrana proti odobratiu vlastnej roly admina).
- Stránky `/prihlasenie` a `/ucet` (mobile-first), hlavička so stavom prihlásenia.
- i18n cez next-intl: všetky texty pre používateľa v `messages/sk.json` (fallback na slovenčinu).
- `ARCHITECTURE.md`, `RUNBOOK.md`, ADR 0003 (tenant = klub); `CLAUDE.md` podľa šablóny konvencií; devlog po dňoch v `devlog/`.
- Testy route handlerov `/api/v1/me` a `/api/v1/users/:id/role` a reprodukčné testy k opraveným bugom.
- Projektové súbory: `CLAUDE.md`, `NEXT.md`, `CHANGELOG.md`, devlog a rozhodnutia (ADR 0001 Better Auth, ADR 0002 Sportnet OIDC).

### Zmenené

- Globálne roly zúžené na `admin_sfz` a `public`; ostatné roly sú roly v klube (ADR 0004).

### Opravené

- Uloženie obsahu z formulára prepísalo text na konce riadkov CRLF (falošná zmena v histórii) – text sa ukladá s LF.
- `INITIAL_ADMIN_EMAILS` povýši na admina SFZ aj existujúci účet pri ďalšom prihlásení (predtým len pri vytvorení účtu).
- Neplatný JSON v tele požiadavky API vracia 400 namiesto 500.
- Prihlásenie na Vercel Preview: odkazy v e-mailoch a callbacky smerovali na `http://localhost:3000`; adresa sa teraz odvodí z adresy nasadenia (len vlastné hostiteľské mená, bez zástupných znakov).
- Prázdne hodnoty v `.env` (`KEY=`) sa berú ako nenastavené (predtým zlyhala validácia).
- MongoDB klient si nepamätá neúspešný prvý pokus o pripojenie; health endpoint loguje dôvod chyby DB.

## [0.1.0] – 2026-10-12

### Pridané

- Kostra aplikácie: Next.js 16, TypeScript, Tailwind 4, základ shadcn/ui.
- API vrstva s jednotným formátom odpovedí a endpoint `/api/v1/health` (stav aplikácie a databázy).
- Pripojenie k MongoDB Atlas, validované premenné prostredia, základ klienta Sportnet.
- CI na GitHube (formát, lint, typy, testy, build), Dependabot, CODEOWNERS, šablóna PR.
- Nasadenie na Vercel (fra1) s doménou rozvojklubu.ltk.solutions.
